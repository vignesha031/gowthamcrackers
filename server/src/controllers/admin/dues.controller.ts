import { and, asc, count, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { enrolments, instalments, plans, users } from '../../db/schema';
import { daysBetween, istToday, monthLabel } from '../../lib/dates';
import { meta, paging, wrap } from '../../lib/http';
import { logActivity } from '../../services/activity';
import { inr, notifyOne } from '../../services/notify';
import { sendPushMessages } from '../../services/push';

/** GET /admin/dues?tab=overdue|due|upcoming&plan=&q=&page= — who still has to pay */
export const dues = wrap(async (req, res) => {
  const p = paging(req.query), today = istToday();
  const f = z.object({ tab: z.enum(['overdue', 'due', 'upcoming']).default('overdue'), plan: z.coerce.number().int().optional(), q: z.string().trim().optional() }).parse(req.query);
  const where = and(
    eq(instalments.status, 'pending'), eq(enrolments.status, 'active'), eq(users.blocked, false),
    f.tab === 'overdue' ? lt(instalments.dueDate, today) : f.tab === 'due' ? and(sql`${instalments.dueDate} >= ${today}`, lte(instalments.month, today)) : sql`${instalments.month} > ${today}`,
    f.plan ? eq(plans.n, f.plan) : undefined,
    f.q ? sql`(${users.name} ilike ${`%${f.q}%`} or ${users.mobile} ilike ${`%${f.q}%`})` : undefined,
  );
  const base = db.select({
    id: instalments.id, no: instalments.no, month: instalments.month, dueDate: instalments.dueDate, amount: instalments.amount, enrolmentId: enrolments.id, enrolNo: enrolments.enrolNo, planN: plans.n,
    customerId: users.id, customerNo: users.customerNo, name: users.name, mobile: users.mobile,
  }).from(instalments).innerJoin(enrolments, eq(instalments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(users, eq(enrolments.userId, users.id));
  const [items, [{ total }], [s]] = await Promise.all([
    base.where(where).orderBy(asc(instalments.dueDate), asc(instalments.no)).limit(p.limit).offset(p.offset),
    db.select({ total: count() }).from(instalments).innerJoin(enrolments, eq(instalments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(users, eq(enrolments.userId, users.id)).where(where),
    db.select({
      overdueCount: sql<number>`count(*) filter (where ${instalments.dueDate} < ${today}::date)::int`,
      overdueAmount: sql<number>`coalesce(sum(${instalments.amount}) filter (where ${instalments.dueDate} < ${today}::date), 0)::int`,
      dueCount: sql<number>`count(*) filter (where ${instalments.dueDate} >= ${today}::date and ${instalments.month} <= ${today}::date)::int`,
      dueAmount: sql<number>`coalesce(sum(${instalments.amount}) filter (where ${instalments.dueDate} >= ${today}::date and ${instalments.month} <= ${today}::date), 0)::int`,
    }).from(instalments).innerJoin(enrolments, eq(instalments.enrolmentId, enrolments.id)).where(and(eq(instalments.status, 'pending'), eq(enrolments.status, 'active'))),
  ]);
  res.json({ summary: s, items: items.map((i) => ({ ...i, daysLate: i.dueDate < today ? daysBetween(i.dueDate, today) : 0 })), pagination: meta(p, total) });
});

/** POST /admin/dues/remind { instalmentIds?: uuid[], allOverdue?: boolean } — one in-app message per member */
export const remind = wrap(async (req, res) => {
  const b = z.object({ instalmentIds: z.array(z.string().uuid()).max(2000).optional(), allOverdue: z.boolean().optional() }).refine((v) => v.allOverdue || v.instalmentIds?.length, { message: 'Pick instalments or choose all overdue' }).parse(req.body);
  const today = istToday();
  const rows = await db.select({ id: instalments.id, enrolmentId: enrolments.id, userId: enrolments.userId, planN: plans.n, amount: instalments.amount, month: instalments.month, dueDay: sql<number>`extract(day from ${instalments.dueDate})::int` })
    .from(instalments).innerJoin(enrolments, eq(instalments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id))
    .where(and(eq(instalments.status, 'pending'), eq(enrolments.status, 'active'), b.allOverdue ? lt(instalments.dueDate, today) : inArray(instalments.id, b.instalmentIds!)));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.enrolmentId, [...(groups.get(r.enrolmentId) ?? []), r]);
  const pushDispatches: { userId: string; notice: { kind: 'dues'; titleTa: string; titleEn: string; bodyTa: string; bodyEn: string } }[] = [];
  for (const g of groups.values()) {
    const first = g.slice().sort((a, c) => a.month.localeCompare(c.month))[0], total = g.reduce((s, r) => s + r.amount, 0);
    const notice: { kind: 'dues'; titleTa: string; titleEn: string; bodyTa: string; bodyEn: string } = g.length === 1
      ? { kind: 'dues', titleTa: 'தவணை நினைவூட்டல்', titleEn: 'Instalment reminder', bodyTa: `Plan ${first.planN} · ${monthLabel(first.month, 'ta')} தவணை ₹${inr(first.amount)} செலுத்த வேண்டும். ஒவ்வொரு மாதமும் ${first.dueDay} தேதிக்குள் செலுத்தினால் போனஸ் கிடைக்கும்.`, bodyEn: `Your Plan ${first.planN} instalment of ₹${inr(first.amount)} for ${monthLabel(first.month, 'en')} is pending. Pay by the ${first.dueDay}th to keep your bonus.` }
      : { kind: 'dues', titleTa: 'தவணை நினைவூட்டல்', titleEn: 'Instalment reminder', bodyTa: `Plan ${first.planN} - ${g.length} தவணைகள் (₹${inr(total)}) நிலுவையில் உள்ளன. தயவுசெய்து செலுத்தவும்.`, bodyEn: `Your Plan ${first.planN} has ${g.length} pending instalments (₹${inr(total)}). Please pay soon.` };
    await notifyOne(db, first.userId, notice);
    pushDispatches.push({ userId: first.userId, notice });
  }
  await sendPushMessages(pushDispatches);
  await logActivity(req, 'dues.remind', 'instalment', undefined, { members: groups.size, instalments: rows.length, allOverdue: !!b.allOverdue });
  res.json({ reminded: groups.size });
});

import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { activityLogs, admins, payments, plans, users, enrolments, instalments } from '../../db/schema';
import { istToday } from '../../lib/dates';
import { csvCell, countOf, meta, paging, wrap } from '../../lib/http';
import { memberFilter, memberRows } from './member.controller';
import { getShop } from '../../services/settings';

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

/** GET /admin/badges — numbers for the sidebar (polled every 30 s) */
export const badges = wrap(async (_req, res) => {
  const [r] = await rows<{ waiting: number; overdue: number }>(sql`select
    (select count(*) from payments where status = 'submitted')::int as waiting,
    (select count(*) from instalments i join enrolments e on e.id = i.enrolment_id where i.status = 'pending' and e.status = 'active' and i.due_date < ${istToday()}::date)::int as overdue`);
  res.json(r);
});

/** GET /admin/dashboard — every number on the dashboard in one round trip */
export const dashboard = wrap(async (_req, res) => {
  const today = istToday(), monthStart = `${today.slice(0, 7)}-01`;
  const [[tot], [wait], [od], [due], byPlan, byMonth, pipeline, [ref], [recent]] = await Promise.all([
    rows<{ customers: number; members: number; completed: number; collected: number; thisMonth: number; today: number; instalments: number; paid: number }>(sql`select
      (select count(*) from users where deleted_at is null)::int as customers,
      (select count(*) from enrolments)::int as members,
      (select count(*) from enrolments where status = 'completed')::int as completed,
      coalesce(sum(amount) filter (where status = 'paid'), 0)::int as collected,
      coalesce(sum(amount) filter (where status = 'paid' and paid_on >= ${monthStart}::date), 0)::int as "thisMonth",
      coalesce(sum(amount) filter (where status = 'paid' and paid_on = ${today}::date), 0)::int as today,
      count(*)::int as instalments, count(*) filter (where status = 'paid')::int as paid
      from instalments`),
    rows<{ count: number; amount: number; oldest: string | null }>(sql`select count(*)::int as count, coalesce(sum(amount), 0)::int as amount, min(created_at) as oldest from payments where status = 'submitted'`),
    rows<{ count: number; amount: number; members: number }>(sql`select count(*)::int as count, coalesce(sum(i.amount), 0)::int as amount, count(distinct i.enrolment_id)::int as members
      from instalments i join enrolments e on e.id = i.enrolment_id where i.status = 'pending' and e.status = 'active' and i.due_date < ${today}::date`),
    rows<{ count: number; amount: number }>(sql`select count(*)::int as count, coalesce(sum(i.amount), 0)::int as amount
      from instalments i join enrolments e on e.id = i.enrolment_id where i.status = 'pending' and e.status = 'active' and i.due_date >= ${today}::date and i.month <= ${today}::date`),
    rows<{ n: number; monthly: number; members: number; collected: number }>(sql`select p.n, p.monthly, count(distinct e.id)::int as members, coalesce(sum(i.amount) filter (where i.status = 'paid'), 0)::int as collected
      from plans p join schemes s on s.id = p.scheme_id and s.open left join enrolments e on e.plan_id = p.id left join instalments i on i.enrolment_id = e.id group by p.id order by p.n`),
    rows<{ month: string; total: number }>(sql`select to_char(paid_on, 'YYYY-MM') as month, sum(amount)::int as total from instalments where status = 'paid' group by 1 order by 1`),
    rows<{ status: string; fulfilment: string; n: number }>(sql`select status, fulfilment_status as fulfilment, count(*)::int as n from enrolments group by 1, 2`),
    rows<{ eligible: number }>(sql`select count(*)::int as eligible from (
      select u.id from users u join users r on r.referred_by = u.id where exists (select 1 from enrolments e where e.user_id = r.id)
      group by u.id having count(*) >= coalesce((select referral_target from schemes where open order by created_at desc limit 1), 5)) x`),
    rows<{ n: number }>(sql`select count(*)::int as n from users where created_at > now() - interval '7 days'`),
  ]);
  res.json({
    today, customers: tot.customers, members: tot.members, completed: tot.completed, newCustomers7d: recent.n,
    collected: { total: tot.collected, thisMonth: tot.thisMonth, today: tot.today, paidInstalments: tot.paid, totalInstalments: tot.instalments },
    waitingVerification: wait, overdue: od, dueNow: due, byPlan, byMonth, pipeline, referralEligible: ref.eligible,
  });
});

const range = (q: Record<string, unknown>) => {
  const to = typeof q.to === 'string' && q.to ? q.to : istToday();
  const from = typeof q.from === 'string' && q.from ? q.from : `${to.slice(0, 7)}-01`;
  return { from, to };
};

/** GET /admin/reports/collections?from=&to= — verified money by day and by payment method */
export const collections = wrap(async (req, res) => {
  const r = range(req.query);
  const [byMethod, daily, byPlan] = await Promise.all([
    rows<{ method: string; count: number; total: number }>(sql`select method, count(*)::int as count, sum(amount)::int as total from payments where status = 'confirmed' and paid_on between ${r.from}::date and ${r.to}::date group by method order by total desc`),
    rows<{ day: string; count: number; total: number }>(sql`select to_char(paid_on, 'YYYY-MM-DD') as day, count(*)::int as count, sum(amount)::int as total from payments where status = 'confirmed' and paid_on between ${r.from}::date and ${r.to}::date group by 1 order by 1`),
    rows<{ n: number; count: number; total: number }>(sql`select pl.n, count(*)::int as count, sum(p.amount)::int as total from payments p join enrolments e on e.id = p.enrolment_id join plans pl on pl.id = e.plan_id where p.status = 'confirmed' and p.paid_on between ${r.from}::date and ${r.to}::date group by pl.n order by pl.n`),
  ]);
  res.json({ ...r, total: byMethod.reduce((s, x) => s + x.total, 0), byMethod, daily, byPlan });
});

const download = (res: import('express').Response, name: string, head: string[], lines: unknown[][]) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.write('﻿' + head.map(csvCell).join(',') + '\n'); // BOM so Excel reads Tamil text correctly
  for (const l of lines) res.write(l.map(csvCell).join(',') + '\n');
  res.end();
};

/** GET /admin/reports/payments.csv?from=&to= */
export const exportPayments = wrap(async (req, res) => {
  const r = range(req.query);
  const data = await db.select({ p: payments, customerNo: users.customerNo, name: users.name, mobile: users.mobile, planN: plans.n, no: instalments.no, month: instalments.month, enrolNo: enrolments.enrolNo, receivedBy: admins.name })
    .from(payments).innerJoin(users, eq(payments.userId, users.id)).innerJoin(enrolments, eq(payments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(instalments, eq(payments.instalmentId, instalments.id))
    .leftJoin(admins, eq(admins.id, payments.receivedBy)).where(sql`${payments.paidOn} between ${r.from}::date and ${r.to}::date`).orderBy(desc(payments.createdAt)).limit(100_000);
  download(res, `payments-${r.from}-to-${r.to}.csv`, ['Receipt', 'Paid on', 'Status', 'Customer No', 'Customer', 'Mobile', 'Member No', 'Plan', 'Instalment', 'Month', 'Amount', 'Method', 'UPI/Bank ref', 'Cash received by', 'Note'],
    data.map(({ p, ...x }) => [p.ref, p.paidOn, p.status, `C${1000 + x.customerNo}`, x.name, x.mobile, `GC-${String(x.enrolNo).padStart(4, '0')}`, `Plan ${x.planN}`, x.no, x.month.slice(0, 7), p.amount, p.method, p.utr, x.receivedBy, p.note]));
});

/** GET /admin/reports/members.csv?status=&fulfilment=&plan= — the packing / delivery list, with Tamil text safe for Excel */
export const exportMembers = wrap(async (req, res) => {
  const [data, shop] = await Promise.all([memberRows(memberFilter(req.query), { limit: 100_000 }), getShop()]);
  const store = (k: string) => shop.stores.find((s) => s.key === k)?.en ?? k;
  download(res, `members-${istToday()}.csv`, ['Member No', 'Customer No', 'Customer', 'Mobile', 'Plan', 'Monthly', 'Paid instalments', 'Total instalments', 'Paid amount', 'Bonus earned', 'Cracker value', 'Plan status', 'Delivery', 'Address / store', 'Fulfilment', 'Tracking', 'Note'],
    data.map((m) => [`GC-${String(m.enrolNo).padStart(4, '0')}`, `C${1000 + m.customer.customerNo}`, m.customer.name, m.customer.mobile, `Plan ${m.planN}`, m.monthly, m.paidCount, m.totalInstalments, m.paidAmount, m.bonusEarned ? 'Yes' : 'No', m.crackerValue, m.status, m.customer.deliveryMode,
      m.customer.deliveryMode === 'pickup' ? store(m.customer.pickupStore) : [m.customer.address, m.customer.city, m.customer.pincode].filter(Boolean).join(', '), m.fulfilmentStatus, m.trackingRef, m.fulfilmentNote]));
});

/** GET /admin/activity?page= */
export const activity = wrap(async (req, res) => {
  const p = paging(req.query);
  const items = await db.select({ id: activityLogs.id, action: activityLogs.action, entity: activityLogs.entity, entityId: activityLogs.entityId, meta: activityLogs.meta, ip: activityLogs.ip, at: activityLogs.createdAt, admin: admins.name })
    .from(activityLogs).leftJoin(admins, eq(activityLogs.adminId, admins.id)).orderBy(desc(activityLogs.createdAt)).limit(p.limit).offset(p.offset);
  res.json({ items, pagination: meta(p, await countOf(activityLogs)) });
});

import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { enrolments, instalments, payments, plans, users } from '../../db/schema';
import { istToday } from '../../lib/dates';
import { HttpError, meta, paging, param, wrap } from '../../lib/http';
import { aggregates, bonusStatus, loadEnrolments } from '../../services/chit';
import { logActivity } from '../../services/activity';
import { notifyOne } from '../../services/notify';
import { sendPushToUsers } from '../../services/push';
import { getShop } from '../../services/settings';

/** One summary row per member (aggregated in SQL, so it stays fast with thousands of members). */
export async function memberRows(where: SQL | undefined, opts: { limit?: number; offset?: number } = {}) {
  const today = istToday();
  const q = db.select({ e: enrolments, plan: plans, user: users, ...aggregates(today) })
    .from(enrolments).innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(users, eq(enrolments.userId, users.id)).leftJoin(instalments, eq(instalments.enrolmentId, enrolments.id))
    .where(where).groupBy(enrolments.id, plans.id, users.id).orderBy(desc(enrolments.createdAt));
  const rows = await (opts.limit ? q.limit(opts.limit).offset(opts.offset ?? 0) : q);
  return rows.map(({ e, plan, user, ...c }) => ({
    id: e.id, enrolNo: e.enrolNo, status: e.status, planN: plan.n, monthly: e.monthly, totalInstalments: e.totalInstalments, bonusAmount: e.bonusAmount, bonusOverride: e.bonusOverride,
    fulfilmentStatus: e.fulfilmentStatus, fulfilmentNote: e.fulfilmentNote, trackingRef: e.trackingRef, joinedAt: e.createdAt,
    ...c, ...bonusStatus(e, c),
    customer: { id: user.id, customerNo: user.customerNo, name: user.name, mobile: user.mobile, deliveryMode: user.deliveryMode, pickupStore: user.pickupStore, address: user.address, city: user.city, pincode: user.pincode },
  }));
}

const filters = (query: Record<string, unknown>) => {
  const f = z.object({
    q: z.string().trim().optional(), status: z.enum(['active', 'completed', 'stopped']).optional(),
    fulfilment: z.enum(['not_started', 'list_received', 'packing', 'dispatched', 'ready_for_pickup', 'delivered']).optional(), plan: z.coerce.number().int().optional(),
  }).parse(query);
  const num = f.q?.match(/^(?:gc-?)?(\d{1,9})$/i)?.[1];
  return and(
    f.status ? eq(enrolments.status, f.status) : undefined, f.fulfilment ? eq(enrolments.fulfilmentStatus, f.fulfilment) : undefined, f.plan ? eq(plans.n, f.plan) : undefined,
    f.q ? or(ilike(users.name, `%${f.q}%`), ilike(users.mobile, `%${f.q}%`), num ? eq(enrolments.enrolNo, Number(num)) : undefined) : undefined,
  );
};

/** GET /admin/members?q=&status=&fulfilment=&plan=&page= */
export const listMembers = wrap(async (req, res) => {
  const p = paging(req.query), where = filters(req.query);
  const [items, [{ total }]] = await Promise.all([
    memberRows(where, p),
    db.select({ total: count() }).from(enrolments).innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(users, eq(enrolments.userId, users.id)).where(where),
  ]);
  res.json({ items, pagination: meta(p, total) });
});
export const memberFilter = filters;

/** GET /admin/members/:id — full instalment table + payment history */
export const memberDetail = wrap(async (req, res) => {
  const id = param(req, 'id');
  const [e] = await loadEnrolments(eq(enrolments.id, id));
  if (!e) throw new HttpError(404, 'Member not found');
  const [[row], pays] = await Promise.all([
    db.select({ u: users }).from(users).innerJoin(enrolments, eq(enrolments.userId, users.id)).where(eq(enrolments.id, id)),
    db.select().from(payments).where(eq(payments.enrolmentId, id)).orderBy(desc(payments.createdAt)),
  ]);
  const u = row.u;
  res.json({ ...e, customer: { id: u.id, customerNo: u.customerNo, name: u.name, mobile: u.mobile, deliveryMode: u.deliveryMode, pickupStore: u.pickupStore, address: u.address, city: u.city, pincode: u.pincode }, payments: pays });
});

const FULFIL_TEXT: Record<string, { ta: string; en: string } | undefined> = {
  list_received: { ta: 'உங்கள் பட்டாசு பட்டியல் கிடைத்தது. விரைவில் பேக் செய்யப்படும்.', en: 'We have received your cracker list. It will be packed soon.' },
  packing: { ta: 'உங்கள் பட்டாசு ஆர்டர் பேக் செய்யப்படுகிறது.', en: 'Your crackers are being packed.' },
  dispatched: { ta: 'உங்கள் பார்சல் அனுப்பப்பட்டது.', en: 'Your parcel has been dispatched.' },
  ready_for_pickup: { ta: 'உங்கள் பட்டாசு கடையில் பெற தயாராக உள்ளது.', en: 'Your crackers are ready for pick-up at the store.' },
  delivered: { ta: 'உங்கள் பட்டாசு வழங்கப்பட்டது. தீபாவளி வாழ்த்துகள்!', en: 'Your crackers have been delivered. Happy Deepavali!' },
};

/** PATCH /admin/members/:id — stop/resume a plan, decide the bonus, move the cracker order forward */
export const updateMember = wrap(async (req, res) => {
  const b = z.object({
    status: z.enum(['active', 'stopped']), bonusOverride: z.enum(['grant', 'forfeit']).nullable(),
    fulfilmentStatus: z.enum(['not_started', 'list_received', 'packing', 'dispatched', 'ready_for_pickup', 'delivered']),
    fulfilmentNote: z.string().trim().max(1000).nullable(), trackingRef: z.string().trim().max(80).nullable(),
  }).partial().parse(req.body);
  const id = param(req, 'id');
  const [e] = await db.select().from(enrolments).where(eq(enrolments.id, id));
  if (!e) throw new HttpError(404, 'Member not found');
  if (b.status && e.status === 'completed') throw new HttpError(409, 'This plan is already completed');
  const [x] = await db.update(enrolments).set(b).where(eq(enrolments.id, id)).returning();
  if (b.fulfilmentStatus && b.fulfilmentStatus !== e.fulfilmentStatus && FULFIL_TEXT[b.fulfilmentStatus]) {
    const t = FULFIL_TEXT[b.fulfilmentStatus]!;
    const shop = await getShop();
    const [u] = await db.select({ mode: users.deliveryMode, store: users.pickupStore }).from(users).where(eq(users.id, e.userId));
    const store = shop.stores.find((s) => s.key === u?.store);
    const tracking = x.trackingRef ? ` (${x.trackingRef})` : '';
    const notice = {
      kind: 'delivery', titleTa: 'பட்டாசு ஆர்டர் நிலை', titleEn: 'Cracker order update',
      bodyTa: `${t.ta}${b.fulfilmentStatus === 'dispatched' ? tracking : ''}${b.fulfilmentStatus === 'ready_for_pickup' && store ? ` ${store.ta}` : ''}`,
      bodyEn: `${t.en}${b.fulfilmentStatus === 'dispatched' ? tracking : ''}${b.fulfilmentStatus === 'ready_for_pickup' && store ? ` ${store.en}` : ''}`,
    } as const;
    await notifyOne(db, e.userId, notice);
    await sendPushToUsers([e.userId], notice);
  }
  await logActivity(req, 'member.update', 'enrolment', id, b);
  res.json({ ok: true });
});

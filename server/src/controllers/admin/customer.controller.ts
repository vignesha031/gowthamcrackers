import { and, count, desc, eq, exists, ilike, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { enrolments, instalments, payments, plans, schemes, users } from '../../db/schema';
import { forgetAuth } from '../../lib/auth';
import { HttpError, meta, paging, param, wrap } from '../../lib/http';
import { loadEnrolments } from '../../services/chit';
import { logActivity } from '../../services/activity';

const live = isNull(users.deletedAt);

/** GET /admin/customers?q=&page= */
export const listCustomers = wrap(async (req, res) => {
  const p = paging(req.query);
  const q = String(req.query.q ?? '').trim();
  const num = q.match(/^c?(\d{4,9})$/i)?.[1];
  const where = and(live, q ? or(ilike(users.name, `%${q}%`), ilike(users.mobile, `%${q}%`), ilike(users.city, `%${q}%`), num ? eq(users.customerNo, Number(num) - 1000) : undefined) : undefined);
  const [items, [{ total }]] = await Promise.all([
    db.select({
      id: users.id, customerNo: users.customerNo, name: users.name, mobile: users.mobile, city: users.city, blocked: users.blocked, joinedAt: users.createdAt, lastLoginAt: users.lastLoginAt,
      plans: sql<number>`(select count(*) from ${enrolments} e where e.user_id = "users"."id")::int`,
      paid: sql<number>`(select coalesce(sum(i.amount), 0) from ${instalments} i join ${enrolments} e on e.id = i.enrolment_id where e.user_id = "users"."id" and i.status = 'paid')::int`,
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(p.limit).offset(p.offset),
    db.select({ total: count() }).from(users).where(where),
  ]);
  res.json({ items, pagination: meta(p, total) });
});

/** GET /admin/customers/:id */
export const customerDetail = wrap(async (req, res) => {
  const id = param(req, 'id');
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw new HttpError(404, 'Customer not found');
  const [members, pays, referred, [by]] = await Promise.all([
    loadEnrolments(eq(enrolments.userId, id)),
    db.select({ p: payments, planN: plans.n, no: instalments.no }).from(payments).innerJoin(instalments, eq(payments.instalmentId, instalments.id)).innerJoin(enrolments, eq(payments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id))
      .where(eq(payments.userId, id)).orderBy(desc(payments.createdAt)).limit(30),
    db.select({ id: users.id, customerNo: users.customerNo, name: users.name, mobile: users.mobile, joined: exists(db.select({ x: sql`1` }).from(enrolments).where(eq(enrolments.userId, users.id))) }).from(users).where(eq(users.referredBy, id)).orderBy(desc(users.createdAt)),
    u.referredBy ? db.select({ id: users.id, customerNo: users.customerNo, name: users.name }).from(users).where(eq(users.id, u.referredBy)) : Promise.resolve([]),
  ]);
  res.json({
    id: u.id, customerNo: u.customerNo, name: u.name, mobile: u.mobile, lang: u.lang, deliveryMode: u.deliveryMode, pickupStore: u.pickupStore, address: u.address, city: u.city, pincode: u.pincode,
    referralCode: u.referralCode, blocked: u.blocked, joinedAt: u.createdAt, lastLoginAt: u.lastLoginAt, referredBy: by ?? null,
    referrals: { joined: referred.filter((r) => r.joined).length, items: referred },
    members, payments: pays.map(({ p, ...r }) => ({ id: p.id, ref: p.ref, amount: p.amount, method: p.method, status: p.status, paidOn: p.paidOn, createdAt: p.createdAt, ...r })),
  });
});

/** GET /admin/referrals?q=&page= — referral relationships and qualification status */
export const listReferrals = wrap(async (req, res) => {
  const p = paging(req.query);
  const q = String(req.query.q ?? '').trim();
  const search = q ? sql`and (
    invitee.name ilike ${`%${q}%`} or invitee.mobile ilike ${`%${q}%`} or
    referrer.name ilike ${`%${q}%`} or referrer.mobile ilike ${`%${q}%`} or
    referrer.referral_code ilike ${`%${q}%`}
  )` : sql``;
  const fromWhere = sql`from users invitee
    join users referrer on referrer.id = invitee.referred_by
    where invitee.referred_by is not null ${search}`;
  const [countResult, results, [scheme]] = await Promise.all([
    db.execute(sql`select count(*)::int as total ${fromWhere}`),
    db.execute(sql`select
      invitee.id as "inviteeId", invitee.name as "inviteeName", invitee.mobile as "inviteeMobile", invitee.created_at as "referredAt",
      referrer.id as "referrerId", referrer.name as "referrerName", referrer.mobile as "referrerMobile", referrer.referral_code as "referralCode",
      exists(select 1 from enrolments e where e.user_id = invitee.id) as joined
      ${fromWhere} order by invitee.created_at desc limit ${p.limit} offset ${p.offset}`),
    db.select({ target: schemes.referralTarget, rewardTa: schemes.referralRewardTa, rewardEn: schemes.referralRewardEn }).from(schemes).where(eq(schemes.open, true)).orderBy(desc(schemes.createdAt)).limit(1),
  ]);
  const [{ total }] = countResult.rows as { total: number }[];
  res.json({ items: results.rows, pagination: meta(p, total), target: scheme?.target ?? 5, rewardTa: scheme?.rewardTa ?? '', rewardEn: scheme?.rewardEn ?? '' });
});

/** PATCH /admin/customers/:id — fix a name / address the customer typed wrong, or block someone */
export const updateCustomer = wrap(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(2).max(120), blocked: z.boolean(), deliveryMode: z.enum(['parcel', 'pickup']), pickupStore: z.string().trim().min(1).max(20),
    address: z.string().trim().max(250), city: z.string().trim().max(80), pincode: z.string().regex(/^\d{6}$/).or(z.literal('')),
  }).partial().parse(req.body);
  const id = param(req, 'id');
  const [x] = await db.update(users).set({ ...b, pincode: b.pincode === '' ? null : b.pincode }).where(and(eq(users.id, id), live)).returning({ id: users.id });
  if (!x) throw new HttpError(404, 'Customer not found');
  forgetAuth(id);
  await logActivity(req, b.blocked === undefined ? 'customer.update' : b.blocked ? 'customer.block' : 'customer.unblock', 'user', id, b);
  res.json({ ok: true });
});

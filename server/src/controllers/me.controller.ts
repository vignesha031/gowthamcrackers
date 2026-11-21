import { and, count, desc, eq, exists, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { enrolments, notifications, schemes, users } from '../db/schema';
import { forgetAuth } from '../lib/auth';
import { HttpError, meta, paging, param, wrap } from '../lib/http';

type U = typeof users.$inferSelect;
export const userDto = (u: U) => ({
  id: u.id, customerNo: u.customerNo, mobile: u.mobile, name: u.name, lang: u.lang, deliveryMode: u.deliveryMode, pickupStore: u.pickupStore,
  address: u.address, city: u.city, pincode: u.pincode, referralCode: u.referralCode,
});

/** How many friends joined a plan using this customer's code. */
export async function referralStats(userId: string) {
  const [r, [s], items] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(eq(users.referredBy, userId), exists(db.select({ x: sql`1` }).from(enrolments).where(eq(enrolments.userId, users.id))))),
    db.select({ target: schemes.referralTarget, ta: schemes.referralRewardTa, en: schemes.referralRewardEn }).from(schemes).where(eq(schemes.open, true)).orderBy(desc(schemes.createdAt)).limit(1),
    db.select({
      id: users.id, name: users.name, deleted: sql<boolean>`${users.deletedAt} is not null`,
      joined: exists(db.select({ x: sql`1` }).from(enrolments).where(eq(enrolments.userId, users.id))),
    }).from(users).where(eq(users.referredBy, userId)).orderBy(desc(users.createdAt)),
  ]);
  return {
    joined: r[0].n, target: s?.target ?? 5, rewardTa: s?.ta ?? '', rewardEn: s?.en ?? '',
    items: items.map(({ deleted, ...item }) => ({ ...item, name: deleted ? null : item.name })),
  };
}

/** GET /me */
export const me = wrap(async (req, res) => {
  const [u] = await db.select().from(users).where(eq(users.id, req.auth!.sub));
  if (!u) throw new HttpError(404, 'Account not found');
  const [unread] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
  res.json({ ...userDto(u), referredBy: !!u.referredBy, referral: await referralStats(u.id), unreadNotifications: unread.n });
});

const text = (max: number) => z.string().trim().max(max);
/** PATCH /me — name, language, how they want to receive crackers, referral code (once) */
export const updateProfile = wrap(async (req, res) => {
  const b = z.object({
    name: text(120).min(2, 'Enter your name'), lang: z.enum(['ta', 'en']), deliveryMode: z.enum(['parcel', 'pickup']), pickupStore: text(20).min(1),
    address: text(250), city: text(80), pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').or(z.literal('')), referralCode: text(12),
  }).partial().parse(req.body);
  const [u] = await db.select().from(users).where(eq(users.id, req.auth!.sub));
  const { referralCode, ...rest } = b;
  const patch: Partial<typeof users.$inferInsert> = { ...rest, pincode: rest.pincode === '' ? null : rest.pincode };
  if (referralCode && !u.referredBy) {
    const [ref] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, referralCode.toUpperCase()));
    if (!ref) throw new HttpError(400, 'This referral code does not exist');
    if (ref.id === u.id) throw new HttpError(400, 'You cannot use your own referral code');
    patch.referredBy = ref.id;
  }
  const [x] = Object.keys(patch).length ? await db.update(users).set(patch).where(eq(users.id, u.id)).returning() : [u];
  res.json(userDto(x));
});

/** DELETE /me — required by the app stores. The login and personal details go; payment records stay for the shop's accounts. */
export const deleteAccount = wrap(async (req, res) => {
  const id = req.auth!.sub;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  await db.update(users).set({ name: 'Deleted customer', mobile: `del${u.customerNo}`, address: null, city: null, pincode: null, referralCode: null, deletedAt: new Date() }).where(eq(users.id, id));
  await db.delete(notifications).where(eq(notifications.userId, id));
  forgetAuth(id);
  res.json({ ok: true });
});

/** GET /me/notifications */
export const listNotifications = wrap(async (req, res) => {
  const p = paging(req.query);
  const where = eq(notifications.userId, req.auth!.sub);
  const [items, [{ total }]] = await Promise.all([
    db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(p.limit).offset(p.offset),
    db.select({ total: count() }).from(notifications).where(where),
  ]);
  res.json({ items: items.map(({ userId, ...n }) => n), pagination: meta(p, total) });
});
export const markAllRead = wrap(async (req, res) => { await db.update(notifications).set({ read: true }).where(eq(notifications.userId, req.auth!.sub)); res.json({ ok: true }); });
export const markRead = wrap(async (req, res) => { await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, param(req, 'id')), eq(notifications.userId, req.auth!.sub))); res.json({ ok: true }); });

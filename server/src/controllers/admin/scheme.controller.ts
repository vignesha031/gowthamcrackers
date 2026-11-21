import { asc, desc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { enrolments, plans, schemes } from '../../db/schema';
import { HttpError, param, wrap } from '../../lib/http';
import { logActivity } from '../../services/activity';
import { bannersSchema, getBanners, getShop, putBanners, putShop, shopSchema } from '../../services/settings';
import { schemeDto } from '../config.controller';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-08-30');
const term = z.object({ ta: z.string().trim().min(1).max(600), en: z.string().trim().max(600).default('') });
const schemeFields = z.object({
  nameTa: z.string().trim().min(2).max(160), nameEn: z.string().trim().min(2).max(160), periodTa: z.string().trim().max(160), periodEn: z.string().trim().max(160),
  startDate: date.refine((d) => d.endsWith('-01'), 'Start date must be the 1st of a month'), instalments: z.number().int().min(1).max(36), bonusInstalments: z.number().int().min(0).max(6),
  dueDay: z.number().int().min(1).max(28), chooseBy: date, parcelFrom: date, pickupBy: date, joinUntil: date.nullable(),
  terms: z.array(term).max(40), referralTarget: z.number().int().min(1).max(100), referralRewardTa: z.string().max(200), referralRewardEn: z.string().max(200), open: z.boolean(),
});
const planFields = z.object({ n: z.number().int().min(1).max(50), monthly: z.number().int().min(50).max(1_000_000), giftTa: z.string().trim().max(200), giftEn: z.string().trim().max(200), active: z.boolean() });

const withPlans = async (s: typeof schemes.$inferSelect) => {
  const ps = await db.select().from(plans).where(eq(plans.schemeId, s.id)).orderBy(asc(plans.n));
  const counts = await db.select({ id: enrolments.planId, n: sql<number>`count(*)::int` }).from(enrolments).where(eq(enrolments.schemeId, s.id)).groupBy(enrolments.planId);
  const dto = schemeDto(s, ps.filter(() => true));
  return { ...dto, open: s.open, plans: ps.map((p) => ({ ...dto.plans.find((x) => x.id === p.id)!, active: p.active, members: counts.find((c) => c.id === p.id)?.n ?? 0 })) };
};

/** GET /admin/schemes */
export const listSchemes = wrap(async (_req, res) => {
  const all = await db.select().from(schemes).orderBy(desc(schemes.createdAt));
  res.json({ items: await Promise.all(all.map(withPlans)) });
});

/** POST /admin/schemes — start next year's scheme. `copyFrom` clones another scheme's plans and terms. */
export const createScheme = wrap(async (req, res) => {
  const b = schemeFields.partial({ terms: true, referralTarget: true, referralRewardTa: true, referralRewardEn: true, open: true, joinUntil: true, bonusInstalments: true, dueDay: true, instalments: true, periodTa: true, periodEn: true })
    .extend({ copyFrom: z.string().uuid().optional() }).parse(req.body);
  const { copyFrom, ...fields } = b;
  const src = copyFrom ? (await db.select().from(schemes).where(eq(schemes.id, copyFrom)))[0] : undefined;
  if (copyFrom && !src) throw new HttpError(404, 'The scheme to copy was not found');
  const id = await db.transaction(async (tx) => {
    const open = fields.open ?? true;
    if (open) await tx.update(schemes).set({ open: false });
    const [s] = await tx.insert(schemes).values({
      instalments: src?.instalments, bonusInstalments: src?.bonusInstalments, dueDay: src?.dueDay, terms: src?.terms ?? [], referralTarget: src?.referralTarget, referralRewardTa: src?.referralRewardTa, referralRewardEn: src?.referralRewardEn,
      periodTa: '', periodEn: '', ...fields, open,
    }).returning();
    if (src) {
      const old = await tx.select().from(plans).where(eq(plans.schemeId, src.id));
      if (old.length) await tx.insert(plans).values(old.map((p) => ({ schemeId: s.id, n: p.n, monthly: p.monthly, giftTa: p.giftTa, giftEn: p.giftEn, active: p.active })));
    }
    return s.id;
  });
  await logActivity(req, 'scheme.create', 'scheme', id, { nameEn: fields.nameEn, copyFrom });
  const [s] = await db.select().from(schemes).where(eq(schemes.id, id));
  res.status(201).json(await withPlans(s));
});

/** PATCH /admin/schemes/:id — dates, terms, referral offer. Existing members keep what they signed up for (amounts are snapshotted). */
export const updateScheme = wrap(async (req, res) => {
  const b = schemeFields.partial().parse(req.body);
  const id = param(req, 'id');
  const [cur] = await db.select().from(schemes).where(eq(schemes.id, id));
  if (!cur) throw new HttpError(404, 'Scheme not found');
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(enrolments).where(eq(enrolments.schemeId, id));
  if (n > 0 && ((b.startDate && b.startDate !== cur.startDate) || (b.instalments && b.instalments !== cur.instalments) || (b.dueDay && b.dueDay !== cur.dueDay)))
    throw new HttpError(409, 'Members have already joined, so the start month, number of instalments and due day can no longer change.', 'SCHEME_LOCKED');
  await db.transaction(async (tx) => {
    if (b.open) await tx.update(schemes).set({ open: false }).where(ne(schemes.id, id));
    await tx.update(schemes).set(b).where(eq(schemes.id, id));
  });
  await logActivity(req, 'scheme.update', 'scheme', id, b);
  const [s] = await db.select().from(schemes).where(eq(schemes.id, id));
  res.json(await withPlans(s));
});

/** POST /admin/schemes/:id/plans */
export const addPlan = wrap(async (req, res) => {
  const b = planFields.partial({ active: true, giftTa: true, giftEn: true }).parse(req.body);
  const id = param(req, 'id');
  const [p] = await db.insert(plans).values({ schemeId: id, ...b }).returning().catch((e) => { throw e?.cause?.code === '23505' ? new HttpError(409, `Plan ${b.n} already exists in this scheme`) : e; });
  await logActivity(req, 'plan.create', 'plan', p.id, b);
  res.status(201).json(p);
});

/** PATCH /admin/plans/:id — change price/gift for NEW members; switch a plan off instead of deleting it */
export const updatePlan = wrap(async (req, res) => {
  const b = planFields.omit({ n: true }).partial().parse(req.body);
  const id = param(req, 'id');
  const [p] = await db.update(plans).set(b).where(eq(plans.id, id)).returning();
  if (!p) throw new HttpError(404, 'Plan not found');
  await logActivity(req, 'plan.update', 'plan', id, b);
  res.json(p);
});

/** GET/PUT /admin/settings/shop — phone, UPI id, bank and store addresses shown in the app */
export const getShopSettings = wrap(async (_req, res) => { res.json(await getShop()); });
export const putShopSettings = wrap(async (req, res) => {
  const shop = shopSchema.parse(req.body);
  await putShop(shop, req.auth!.sub);
  await logActivity(req, 'settings.shop', 'settings', 'shop');
  res.json(shop);
});

export const getBannersAdmin = wrap(async (_req, res) => { res.json(await getBanners()); });
export const putBannersAdmin = wrap(async (req, res) => {
  const banners = bannersSchema.parse(req.body);
  await putBanners(banners, req.auth!.sub);
  await logActivity(req, 'settings.banners', 'settings', 'banners', { count: banners.length, active: banners.filter((banner) => banner.active).length });
  res.json(banners);
});

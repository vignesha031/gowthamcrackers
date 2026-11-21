import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { plans, schemes } from '../db/schema';
import { istToday } from '../lib/dates';
import { wrap } from '../lib/http';
import { getBanners, getShop } from '../services/settings';
import { otpLength } from './auth.controller';

export const schemeDto = (s: typeof schemes.$inferSelect, ps: (typeof plans.$inferSelect)[]) => ({
  id: s.id, nameTa: s.nameTa, nameEn: s.nameEn, periodTa: s.periodTa, periodEn: s.periodEn, startDate: s.startDate, instalments: s.instalments,
  bonusInstalments: s.bonusInstalments, dueDay: s.dueDay, chooseBy: s.chooseBy, parcelFrom: s.parcelFrom, pickupBy: s.pickupBy, joinUntil: s.joinUntil,
  terms: s.terms as { ta: string; en: string }[], referralTarget: s.referralTarget, referralRewardTa: s.referralRewardTa, referralRewardEn: s.referralRewardEn,
  plans: ps.sort((a, b) => a.n - b.n).map((p) => ({ id: p.id, n: p.n, monthly: p.monthly, giftTa: p.giftTa, giftEn: p.giftEn, bonus: p.monthly * s.bonusInstalments, total: p.monthly * s.instalments, crackerValue: p.monthly * (s.instalments + s.bonusInstalments) })),
});

/** GET /config — everything the app needs before login: shop details, the open scheme with its plans, terms. No code release needed for next year's scheme. */
export const config = wrap(async (_req, res) => {
  const [s] = await db.select().from(schemes).where(eq(schemes.open, true)).orderBy(desc(schemes.createdAt)).limit(1);
  const ps = s ? await db.select().from(plans).where(and(eq(plans.schemeId, s.id), eq(plans.active, true))).orderBy(asc(plans.n)) : [];
  const today = istToday();
  res.json({ today, otpLength: otpLength(), shop: await getShop(), banners: (await getBanners()).filter((banner) => banner.active), scheme: s ? { ...schemeDto(s, ps), joinOpen: !s.joinUntil || today <= s.joinUntil } : null });
});

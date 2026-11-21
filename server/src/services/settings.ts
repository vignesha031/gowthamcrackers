import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { appSettings } from '../db/schema';

export const shopSchema = z.object({
  nameTa: z.string().min(1).max(80), nameEn: z.string().min(1).max(80), subTa: z.string().max(80).default(''), since: z.number().int().min(1900).max(2100),
  legalName: z.string().min(1).max(120),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'), complaintsPhone: z.string().regex(/^[6-9]\d{9}$/).or(z.literal('')).default(''),
  upiId: z.string().min(3).max(80),
  bank: z.object({ number: z.string().max(30), name: z.string().max(120), ifsc: z.string().max(20), type: z.string().max(40), bank: z.string().max(60), branch: z.string().max(80) }),
  stores: z.array(z.object({ key: z.string().min(1).max(20), ta: z.string().max(100), en: z.string().max(100), addrTa: z.string().max(300), addrEn: z.string().max(300), map: z.string().max(300) })).max(10),
});
export type Shop = z.infer<typeof shopSchema>;

export const bannerSchema = z.object({
  id: z.string().uuid(), title: z.string().max(100).default(''), image: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/), active: z.boolean().default(true),
});
export const bannersSchema = z.array(bannerSchema).max(8);
export type Banner = z.infer<typeof bannerSchema>;

export const DEFAULT_SHOP: Shop = {
  nameTa: 'கௌதம்', nameEn: 'Gowtham Crackers', subTa: 'பட்டாசு கடை', since: 1987, legalName: 'GOWTHAMS PYRO TECH',
  phone: '9003631777', complaintsPhone: '9524121777', upiId: '335289536383490@cnrb',
  bank: { number: '120037383490', name: 'GOWTHAMS PYRO TECH', ifsc: 'CNRB0016224', type: 'Current Account', bank: 'Canara Bank', branch: 'Amman Sannathi' },
  stores: [
    { key: 'main', ta: 'நாகமலை புதுக்கோட்டை', en: 'Nagamalai Pudukottai', addrTa: '22/3a, தேனி மெயின் ரோடு, மதுரை - 19\nஎலைட் மாஸ்டர் மஹால் அருகில்', addrEn: '22/3a, Theni Main Road, Madurai - 19\nNear Elite Master Mahal', map: 'Gowtham Crackers 22/3a Theni Main Road Nagamalai Pudukottai Madurai 625019' },
    { key: 'branch', ta: 'ஸ்ரீ பெரியாச்சி (கிளை)', en: 'Sri Periyachi (Branch)', addrTa: '279, கீழ மாசி வீதி, மதுரை - 01\nதேர் முட்டி அருகில்', addrEn: '279, Keezha Masi Street, Madurai - 01\nNear Ther Mutti', map: 'Sri Periyachi Crackers 279 Keezha Masi Street Madurai 625001' },
  ],
};

export async function getShop(): Promise<Shop> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.key, 'shop'));
  return r ? shopSchema.parse(r.value) : DEFAULT_SHOP;
}
export async function putShop(shop: Shop, adminId: string) {
  await db.insert(appSettings).values({ key: 'shop', value: shop, updatedBy: adminId }).onConflictDoUpdate({ target: appSettings.key, set: { value: shop, updatedBy: adminId, updatedAt: new Date() } });
}

export async function getBanners(): Promise<Banner[]> {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.key, 'banners'));
  return r ? bannersSchema.parse(r.value) : [];
}
export async function putBanners(banners: Banner[], adminId: string) {
  await db.insert(appSettings).values({ key: 'banners', value: banners, updatedBy: adminId }).onConflictDoUpdate({ target: appSettings.key, set: { value: banners, updatedBy: adminId, updatedAt: new Date() } });
}

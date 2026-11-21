import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { count } from 'drizzle-orm';
import { db, pool } from './index';
import { admins, appSettings, plans, schemes } from './schema';
import { DEFAULT_SHOP } from '../services/settings';

/** Terms & conditions exactly as printed on the back of the 2027 flyer (Tamil is the original; English is a translation). */
export const TERMS_2027 = [
  { ta: 'ஒவ்வொரு மாதந்தோறும் சரியாக முதல் 10 தேதிக்குள் தவணை செலுத்திய நபருக்கு மட்டுமே போனஸ் தொகை மற்றும் Free Gift வழங்கப்படும்.', en: 'The bonus amount and Free Gift are given only to customers who pay every month’s instalment on or before the 10th.' },
  { ta: 'பணம் அனுப்பிய ஸ்க்ரீன் ஷாட்-ஐ 90036 31777 என்ற வாட்ஸ்-அப் எண்ணிற்கு அனுப்பி வைக்கவும்.', en: 'Send the screenshot of your payment to WhatsApp 90036 31777.' },
  { ta: 'பண்டு பணம் போக கூடுதலாக ஆர்டர் செய்தால் அதற்கு உண்டான பணத்தை செலுத்திய உடன் பார்சல் அனுப்பி வைக்கப்படும்.', en: 'If you order crackers worth more than your savings, the parcel is sent as soon as you pay the extra amount.' },
  { ta: 'Plan 1, Plan 2 தேர்வு செய்பவர்களுக்கு Free Gift ஆக Calendar வழங்கப்படும்.', en: 'Plan 1 and Plan 2 customers get a Calendar as the Free Gift.' },
  { ta: 'Plan 3, Plan 4, Plan 5, Plan 6 தேர்வு செய்பவர்களுக்கு Free Gift ஆக Calendar + Special Gift 1 No.s (Anyone) வழங்கப்படும்.', en: 'Plan 3, 4, 5 and 6 customers get a Calendar + 1 Special Gift (any one) as the Free Gift.' },
  { ta: 'சேமிப்பு திட்டத்தை இடையில் நிறுத்தினால் செலுத்திய தொகைக்கு பட்டாசு மட்டுமே பெற்றுக்கொள்ளலாம் (போனஸ் தொகை வழங்கப்படாது).', en: 'If you stop the scheme midway, you can take only crackers worth the amount paid (no bonus amount).' },
  { ta: '2027 ஆகஸ்ட் மாதத்திற்கான தவணையை கட்டிமுடித்தவுடன், வாடிக்கையாளர்கள் தங்களுக்கு விருப்பமான பட்டாசுகளை ஆகஸ்ட் 30-க்குள் தேர்வு செய்து கொடுக்க வேண்டும்.', en: 'After completing the August 2027 instalment, customers must choose their crackers and give the list by 30 August.' },
  { ta: 'ஆகஸ்ட் 30, 2027-க்குள் ஆர்டர் செய்யாதவர்களுக்கு, நிர்வாகம் பொறுப்பேற்று அவர்கள் செலுத்திய தொகைக்கு இணையான பட்டாசுகளை நிர்வாகத்தின் விருப்பப்படி பார்சல் செய்து அனுப்பி வைக்கப்படும்.', en: 'For customers who do not order by 30 Aug 2027, the management will pack and send crackers equal to the amount paid, at its own choice.' },
  { ta: 'நீங்கள் செலுத்திய தொகைக்கான பட்டாசு பொருட்கள் செப்டம்பர் 20, 2027 தேதி முதல் பார்சல் சர்வீஸ் மூலமாக உங்களுக்கு அனுப்பி வைக்கப்படும்.', en: 'Crackers for the amount you paid will be sent by parcel service from 20 September 2027.' },
  { ta: 'மதுரையில் இருக்கும் வாடிக்கையாளர்கள் செப்டம்பர் 25-ஆம் தேதிக்குள் கீழ்காணும் நமது கடைகளில் முன்னதாக தெரிவித்த பின் நேரில் வந்து பெற்றுக்கொள்ளலாம்.', en: 'Customers in Madurai can collect in person from the stores below by 25 September, after informing us in advance.' },
];

const CALENDAR = { ta: 'காலண்டர்', en: 'Calendar' };
const CALENDAR_PLUS = { ta: 'காலண்டர் + சிறப்பு பரிசு 1 (ஏதேனும் ஒன்று)', en: 'Calendar + 1 special gift (any one)' };

export async function seed() {
  const [{ n }] = await db.select({ n: count() }).from(schemes);
  if (n === 0) {
    const [s] = await db.insert(schemes).values({
      nameTa: 'தீபாவளி பட்டாசு சிறுசேமிப்பு திட்டம் 2027', nameEn: 'Deepavali Crackers Savings Scheme 2027',
      periodTa: 'டிசம்பர் 2026 முதல் செப்டம்பர் 2027 வரை', periodEn: 'Dec 2026 to Sep 2027',
      startDate: '2026-12-01', instalments: 9, bonusInstalments: 1, dueDay: 10, chooseBy: '2027-08-30', parcelFrom: '2027-09-20', pickupBy: '2027-09-25',
      terms: TERMS_2027, referralTarget: 5, referralRewardTa: '5+ வாடிக்கையாளர்களை பரிந்துரைத்தால் 30 ஷாட்ஸ் இலவசம்!', referralRewardEn: 'Refer 5+ customers and get FREE 30 shots!',
    }).returning();
    await db.insert(plans).values([300, 500, 700, 1000, 1500, 2000].map((monthly, i) => ({ schemeId: s.id, n: i + 1, monthly, giftTa: (i < 2 ? CALENDAR : CALENDAR_PLUS).ta, giftEn: (i < 2 ? CALENDAR : CALENDAR_PLUS).en })));
  }
  await db.insert(appSettings).values({ key: 'shop', value: DEFAULT_SHOP }).onConflictDoNothing();
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
  if (email && password) await db.insert(admins).values({ name: 'Owner', email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role: 'super_admin', mustChangePassword: false }).onConflictDoNothing();
  else console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin login was created');
}

if (require.main === module) {
  seed().then(() => { console.log('Seed complete'); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); });
}

export const inr = (n: number) => n.toLocaleString('en-IN');

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];

type L = 'ta' | 'en';
const parts = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m: m - 1, d };
};
const monthName = (m: number, lang: L) => (lang === 'ta' ? MONTHS_TA : MONTHS_EN)[m];

/** '2027-08-30' → '30 Aug 2027' / 'ஆகஸ்ட் 30, 2027' */
export function fmtDay(iso: string | null | undefined, lang: L) {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  return lang === 'ta' ? `${monthName(m, lang)} ${d}, ${y}` : `${d} ${monthName(m, lang)} ${y}`;
}

/** '2026-12-01' → 'Dec 2026' / 'டிசம்பர் 2026' */
export function monthYear(iso: string, lang: L) {
  const { y, m } = parts(iso);
  return `${monthName(m, lang)} ${y}`;
}

/** The first of the month `n` months after `iso`. */
export function addMonths(iso: string, n: number) {
  const { y, m } = parts(iso);
  const d = new Date(Date.UTC(y, m + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** ISO timestamp (createdAt) → '19 Nov 2026' */
export const fmtStamp = (iso: string, lang: L) => fmtDay(new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), lang);

export function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('0091')) return digits.slice(4);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

/** 9003631777 → '90036 31777' */
export const phoneDisplay = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);


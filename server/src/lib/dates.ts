/** All business dates are Indian dates ('YYYY-MM-DD', Asia/Kolkata), never server-local time. */
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export const istToday = (now = new Date()) => fmt.format(now);
/** Midnight (IST) at the start of a 'YYYY-MM-DD' date. */
export const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
const utc = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(utc(d) + n * 86_400_000);
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);
/** First day of the month `n` months after the month of `d`. */
export const addMonths = (d: string, n: number) => { const [y, m] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return iso(+t); };
export const withDay = (monthStart: string, day: number) => `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`;

const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
/** '2026-12-01' → 'Dec 2026' / 'டிசம்பர் 2026' */
export const monthLabel = (d: string, lang: 'ta' | 'en') => { const m = Number(d.slice(5, 7)) - 1; return `${(lang === 'ta' ? TA : EN)[m]} ${d.slice(0, 4)}`; };
/** '2027-08-30' → '30 Aug 2027' / 'ஆகஸ்ட் 30, 2027' */
export const dayLabel = (d: string, lang: 'ta' | 'en') => { const m = Number(d.slice(5, 7)) - 1, day = Number(d.slice(8, 10)); return lang === 'ta' ? `${TA[m]} ${day}, ${d.slice(0, 4)}` : `${day} ${EN[m]} ${d.slice(0, 4)}`; };

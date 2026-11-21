const inr = new Intl.NumberFormat('en-IN');
export const money = (n: number | null | undefined) => `₹${inr.format(Math.round(Number(n ?? 0)))}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-12-10" or an ISO timestamp -> "10 Dec 2026" (timestamps shown in IST). */
export function date(v?: string | null): string {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; }
  const t = new Date(v); if (isNaN(+t)) return '—';
  const ist = new Date(+t + 5.5 * 3600e3);
  return `${ist.getUTCDate()} ${MON[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}
export function dateTime(v?: string | null): string {
  if (!v) return '—';
  const t = new Date(v); if (isNaN(+t)) return '—';
  const ist = new Date(+t + 5.5 * 3600e3);
  const h = ist.getUTCHours(), m = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${date(v)}, ${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'am' : 'pm'}`;
}
export const monthName = (v: string) => { const [y, m] = v.slice(0, 7).split('-').map(Number); return `${MON[m - 1]} ${y}`; };
export const memberNo = (n: number) => `GC-${String(n).padStart(4, '0')}`;
export const customerNo = (n: number) => `C${1000 + n}`;
export const todayISO = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
export const cap = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const FULFIL = ['not_started', 'list_received', 'packing', 'dispatched', 'ready_for_pickup', 'delivered'];

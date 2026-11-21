import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db, type Tx } from '../db';
import { enrolments, instalments, payments, plans, schemes } from '../db/schema';
import { addMonths, dayLabel, istToday, monthLabel, withDay } from '../lib/dates';
import { HttpError } from '../lib/http';
import { inr, notifyOne, type Notice } from './notify';
import { sendPushMessages } from './push';

type Scheme = typeof schemes.$inferSelect;
type Plan = typeof plans.$inferSelect;
type Enrolment = typeof enrolments.$inferSelect;
type Instalment = typeof instalments.$inferSelect;
type Payment = typeof payments.$inferSelect;

export const MAX_ACTIVE_ENROLMENTS = 5;

/** pending/submitted/paid as stored, turned into what the customer should see. */
export type InstalmentState = 'paid' | 'verifying' | 'overdue' | 'due' | 'upcoming';
export function instalmentState(i: Pick<Instalment, 'status' | 'dueDate' | 'month'>, today: string): InstalmentState {
  if (i.status === 'paid') return 'paid';
  if (i.status === 'submitted') return 'verifying';
  if (i.dueDate < today) return 'overdue';
  if (i.month <= today) return 'due';
  return 'upcoming';
}

/** The instalment rows for a new member: one per month from the scheme's start, each due on the scheme's due day. */
export function buildSchedule(scheme: Pick<Scheme, 'startDate' | 'instalments' | 'dueDay'>, monthly: number) {
  return Array.from({ length: scheme.instalments }, (_, i) => {
    const month = addMonths(scheme.startDate, i);
    return { no: i + 1, month, dueDate: withDay(month, scheme.dueDay), amount: monthly };
  });
}

export type Counts = { paidCount: number; paidAmount: number; verifyingCount: number; verifyingAmount: number; overdueCount: number; lateCount: number; totalCount: number };

/** The bonus + free gift rule from the flyer, in one place. */
export function bonusStatus(e: Pick<Enrolment, 'bonusOverride' | 'bonusAmount' | 'monthly' | 'totalInstalments' | 'status'>, c: Counts) {
  const auto = c.lateCount === 0 && c.overdueCount === 0;
  const safe = e.bonusOverride === 'grant' ? true : e.bonusOverride === 'forfeit' ? false : auto;
  const allPaid = c.totalCount > 0 && c.paidCount === c.totalCount;
  const earned = allPaid && safe;
  return {
    bonusSafe: safe, bonusEarned: earned,
    /** what the member can order crackers for right now */
    crackerValue: c.paidAmount + (earned ? e.bonusAmount : 0),
    /** what they will get if they keep paying on time */
    crackerValueIfOnTrack: e.monthly * e.totalInstalments + e.bonusAmount,
  };
}

export function toDto(r: { e: Enrolment; plan: Plan; scheme: Scheme }, insts: Instalment[], pays: Payment[], today: string) {
  const byInst = new Map<string, Payment[]>();
  for (const p of pays) byInst.set(p.instalmentId, [...(byInst.get(p.instalmentId) ?? []), p]);
  const rows = insts.slice().sort((a, b) => a.no - b.no).map((i) => {
    const ps = (byInst.get(i.id) ?? []).sort((a, b) => +b.createdAt - +a.createdAt);
    const waiting = ps.find((p) => p.status === 'submitted');
    const rejected = i.status === 'pending' ? ps.find((p) => p.status === 'rejected') : undefined;
    const paidOn = i.paidOn ?? waiting?.paidOn ?? null;
    // a payment waiting for the shop to verify already counts as late if it was sent after the 10th
    const onTime = i.status === 'paid' ? i.onTime : waiting ? waiting.paidOn <= i.dueDate : null;
    return {
      id: i.id, no: i.no, month: i.month, dueDate: i.dueDate, amount: i.amount, status: i.status, state: instalmentState(i, today),
      paidOn, onTime, paymentRef: (waiting ?? ps.find((p) => p.status === 'confirmed'))?.ref ?? null, rejectedReason: rejected?.rejectReason ?? null,
    };
  });
  const counts: Counts = {
    totalCount: rows.length,
    paidCount: rows.filter((i) => i.state === 'paid').length,
    paidAmount: rows.filter((i) => i.state === 'paid').reduce((s, i) => s + i.amount, 0),
    verifyingCount: rows.filter((i) => i.state === 'verifying').length,
    verifyingAmount: rows.filter((i) => i.state === 'verifying').reduce((s, i) => s + i.amount, 0),
    overdueCount: rows.filter((i) => i.state === 'overdue').length,
    lateCount: rows.filter((i) => (i.state === 'paid' || i.state === 'verifying') && i.onTime === false).length,
  };
  const next = rows.find((i) => i.status === 'pending') ?? null;
  const { e, plan, scheme } = r;
  return {
    id: e.id, enrolNo: e.enrolNo, status: e.status, joinedAt: e.createdAt,
    planN: plan.n, monthly: e.monthly, totalInstalments: e.totalInstalments, bonusAmount: e.bonusAmount, giftTa: plan.giftTa, giftEn: plan.giftEn,
    schemeId: scheme.id, schemeNameTa: scheme.nameTa, schemeNameEn: scheme.nameEn,
    chooseBy: scheme.chooseBy, parcelFrom: scheme.parcelFrom, pickupBy: scheme.pickupBy, dueDay: scheme.dueDay,
    bonusOverride: e.bonusOverride,
    fulfilment: { status: e.fulfilmentStatus, note: e.fulfilmentNote, trackingRef: e.trackingRef },
    ...counts, ...bonusStatus(e, counts),
    nextNo: next?.no ?? null, instalments: rows,
  };
}
export type EnrolmentDto = ReturnType<typeof toDto>;

/** Loads enrolments (with every instalment) matching `where`. */
export async function loadEnrolments(where: SQL | undefined, today = istToday()): Promise<EnrolmentDto[]> {
  const rows = await db.select({ e: enrolments, plan: plans, scheme: schemes }).from(enrolments)
    .innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(schemes, eq(enrolments.schemeId, schemes.id))
    .where(where).orderBy(desc(enrolments.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.e.id);
  const [insts, pays] = await Promise.all([
    db.select().from(instalments).where(inArray(instalments.enrolmentId, ids)),
    db.select().from(payments).where(inArray(payments.enrolmentId, ids)).orderBy(desc(payments.createdAt)),
  ]);
  const gi = (id: string) => insts.filter((i) => i.enrolmentId === id), gp = (id: string) => pays.filter((p) => p.enrolmentId === id);
  return rows.map((r) => toDto(r, gi(r.e.id), gp(r.e.id), today));
}

// ───────────── joining ─────────────
export async function joinPlan(userId: string, planId: string) {
  const today = istToday();
  const [row] = await db.select({ plan: plans, scheme: schemes }).from(plans).innerJoin(schemes, eq(plans.schemeId, schemes.id)).where(eq(plans.id, planId));
  if (!row || !row.plan.active || !row.scheme.open) throw new HttpError(404, 'This plan is not available');
  if (row.scheme.joinUntil && today > row.scheme.joinUntil) throw new HttpError(400, 'Joining is closed for this scheme', 'JOIN_CLOSED');
  const mine = await db.select().from(enrolments).where(eq(enrolments.userId, userId));
  const recent = mine.find((e) => e.planId === planId && Date.now() - +e.createdAt < 60_000); // double-tap guard
  if (recent) return recent;
  if (mine.filter((e) => e.status === 'active').length >= MAX_ACTIVE_ENROLMENTS) throw new HttpError(400, `You can have at most ${MAX_ACTIVE_ENROLMENTS} active plans`, 'TOO_MANY_PLANS');
  const notice: Notice = {
    kind: 'general', titleTa: `Plan ${row.plan.n}-ல் இணைந்தீர்கள்!`, titleEn: `Welcome to Plan ${row.plan.n}!`,
    bodyTa: `மாதம் ₹${inr(row.plan.monthly)} வீதம் ${row.scheme.instalments} மாதங்கள் செலுத்துங்கள். ஒவ்வொரு மாதமும் ${row.scheme.dueDay} தேதிக்குள் செலுத்தினால் போனஸ் & பரிசு கிடைக்கும்.`,
    bodyEn: `Pay ₹${inr(row.plan.monthly)} a month for ${row.scheme.instalments} months. Pay by the ${row.scheme.dueDay}th each month to keep your bonus & gift.`,
  };
  const created = await db.transaction(async (tx) => {
    const { plan, scheme } = row;
    const [e] = await tx.insert(enrolments).values({ userId, planId: plan.id, schemeId: scheme.id, monthly: plan.monthly, totalInstalments: scheme.instalments, bonusAmount: plan.monthly * scheme.bonusInstalments }).returning();
    await tx.insert(instalments).values(buildSchedule(scheme, plan.monthly).map((i) => ({ ...i, enrolmentId: e.id })));
    await notifyOne(tx, userId, notice);
    return e;
  });
  await sendPushMessages([{ userId, notice }]);
  return created;
}

// ───────────── payments ─────────────
const REF_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRef(now = new Date()) {
  const d = istToday(now).replace(/-/g, '').slice(2);
  let s = '';
  for (let i = 0; i < 4; i++) s += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  return `GC${d}-${s}`;
}

/** The customer says "I have paid" for their next unpaid instalment. Waits for the shop to verify it. */
export async function submitPayment(userId: string, enrolmentId: string, input: { method: 'upi' | 'bank'; utr?: string; idempotencyKey?: string }) {
  if (input.idempotencyKey) {
    const [dup] = await db.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.idempotencyKey, input.idempotencyKey)));
    if (dup) return { payment: dup, duplicate: true };
  }
  return db.transaction(async (tx) => {
    const [e] = await tx.select().from(enrolments).where(and(eq(enrolments.id, enrolmentId), eq(enrolments.userId, userId))).for('update');
    if (!e) throw new HttpError(404, 'Plan not found');
    if (e.status !== 'active') throw new HttpError(409, 'This plan is not active any more');
    const insts = await tx.select().from(instalments).where(eq(instalments.enrolmentId, e.id)).orderBy(asc(instalments.no));
    if (insts.filter((i) => i.status === 'submitted').length >= 2) throw new HttpError(409, 'Your earlier payments are still being verified. Please wait for the shop to confirm them.', 'AWAITING_VERIFICATION');
    const next = insts.find((i) => i.status === 'pending');
    if (!next) throw new HttpError(409, 'All instalments are already paid or waiting for verification', 'NOTHING_TO_PAY');
    const [p] = await tx.insert(payments).values({
      ref: newRef(), userId, enrolmentId: e.id, instalmentId: next.id, amount: next.amount, method: input.method, utr: input.utr?.trim() || null,
      paidOn: istToday(), idempotencyKey: input.idempotencyKey,
    }).returning();
    await tx.update(instalments).set({ status: 'submitted' }).where(eq(instalments.id, next.id));
    return { payment: p, duplicate: false, instalmentNo: next.no };
  });
}

/** Marks an instalment as paid + verified. Used for both "shop confirms a customer's payment" and "cash at the counter". */
async function settleInstalment(tx: Tx, p: Payment, paidOn: string) {
  const [i] = await tx.update(instalments).set({ status: 'paid', paidOn, onTime: sql`${paidOn}::date <= ${instalments.dueDate}` }).where(eq(instalments.id, p.instalmentId)).returning();
  const [open] = await tx.select({ n: sql<number>`count(*)::int` }).from(instalments).where(and(eq(instalments.enrolmentId, p.enrolmentId), sql`${instalments.status} <> 'paid'`));
  const [e] = await tx.select({ e: enrolments, plan: plans, scheme: schemes }).from(enrolments).innerJoin(plans, eq(enrolments.planId, plans.id)).innerJoin(schemes, eq(enrolments.schemeId, schemes.id)).where(eq(enrolments.id, p.enrolmentId));
  const done = open.n === 0;
  if (done && e.e.status === 'active') await tx.update(enrolments).set({ status: 'completed' }).where(eq(enrolments.id, e.e.id));
  const late = !i.onTime;
  const pushNotices: Notice[] = [];
  const paymentNotice: Notice = {
    kind: 'payments',
    titleTa: `₹${inr(p.amount)} உறுதி செய்யப்பட்டது`, titleEn: `₹${inr(p.amount)} confirmed`,
    bodyTa: `Plan ${e.plan.n} · ${monthLabel(i.month, 'ta')} தவணை உறுதி செய்யப்பட்டது.${late ? ` ${e.scheme.dueDay} தேதிக்குப் பின் செலுத்தியதால் போனஸ் & பரிசு பாதிக்கப்படும்.` : ''}`,
    bodyEn: `Your Plan ${e.plan.n} instalment for ${monthLabel(i.month, 'en')} is confirmed.${late ? ` It was paid after the ${e.scheme.dueDay}th, so the bonus & gift are at risk.` : ''}`,
  };
  await notifyOne(tx, p.userId, paymentNotice);
  pushNotices.push(paymentNotice);
  if (done) {
    const completeNotice: Notice = {
      kind: 'general', titleTa: 'அனைத்து தவணைகளும் முடிந்தன!', titleEn: 'All instalments complete!',
      bodyTa: `${dayLabel(e.scheme.chooseBy, 'ta')}-க்குள் உங்கள் பட்டாசு பட்டியலை வாட்ஸ்அப்பில் அனுப்புங்கள்.`,
      bodyEn: `Send your cracker list on WhatsApp by ${dayLabel(e.scheme.chooseBy, 'en')}.`,
    };
    await notifyOne(tx, p.userId, completeNotice);
    pushNotices.push(completeNotice);
  }
  return { instalment: i, completed: done, pushNotices };
}

export async function confirmPayment(paymentId: string, adminId: string, paidOn?: string) {
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.update(payments).set({ status: 'confirmed', reviewedBy: adminId, reviewedAt: new Date(), ...(paidOn && { paidOn }) })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'submitted'))).returning();
    if (!p) throw new HttpError(409, 'This payment was already reviewed');
    return { payment: p, ...(await settleInstalment(tx, p, p.paidOn)) };
  });
  await sendPushMessages(result.pushNotices.map((notice) => ({ userId: result.payment.userId, notice })));
  return result;
}

export async function rejectPayment(paymentId: string, adminId: string, reason: string) {
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.update(payments).set({ status: 'rejected', reviewedBy: adminId, reviewedAt: new Date(), rejectReason: reason })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'submitted'))).returning();
    if (!p) throw new HttpError(409, 'This payment was already reviewed');
    const [i] = await tx.update(instalments).set({ status: 'pending' }).where(eq(instalments.id, p.instalmentId)).returning();
    const notice: Notice = {
      kind: 'payments', titleTa: 'பணம் சரிபார்க்க முடியவில்லை', titleEn: 'We could not verify your payment',
      bodyTa: `${monthLabel(i.month, 'ta')} தவணை: ${reason}. சரியான ஸ்க்ரீன் ஷாட்டை வாட்ஸ்அப்பில் அனுப்பி மீண்டும் முயற்சிக்கவும்.`,
      bodyEn: `${monthLabel(i.month, 'en')} instalment: ${reason}. Please send a correct screenshot on WhatsApp and try again.`,
    };
    await notifyOne(tx, p.userId, notice);
    return { payment: p, notice };
  });
  await sendPushMessages([{ userId: result.payment.userId, notice: result.notice }]);
  return result.payment;
}

/** Cash handed over at the shop: recorded and verified in one step. */
export async function recordCash(adminId: string, enrolmentId: string, input: { instalmentNo?: number; paidOn?: string; note?: string }) {
  const result = await db.transaction(async (tx) => {
    const [e] = await tx.select().from(enrolments).where(eq(enrolments.id, enrolmentId)).for('update');
    if (!e) throw new HttpError(404, 'Member not found');
    if (e.status === 'stopped') throw new HttpError(409, 'This plan was stopped');
    const insts = await tx.select().from(instalments).where(eq(instalments.enrolmentId, e.id)).orderBy(asc(instalments.no));
    const target = input.instalmentNo ? insts.find((i) => i.no === input.instalmentNo) : insts.find((i) => i.status === 'pending');
    if (!target) throw new HttpError(404, 'No instalment to pay');
    if (target.status === 'paid') throw new HttpError(409, `Instalment ${target.no} is already paid`);
    if (target.status === 'submitted') throw new HttpError(409, `The customer already sent a payment for instalment ${target.no}. Confirm that one instead.`, 'AWAITING_VERIFICATION');
    const paidOn = input.paidOn ?? istToday();
    const [p] = await tx.insert(payments).values({
      ref: newRef(), userId: e.userId, enrolmentId: e.id, instalmentId: target.id, amount: target.amount, method: 'cash', status: 'confirmed',
      paidOn, receivedBy: adminId, reviewedBy: adminId, reviewedAt: new Date(), note: input.note,
    }).returning();
    return { payment: p, ...(await settleInstalment(tx, p, paidOn)) };
  });
  await sendPushMessages(result.pushNotices.map((notice) => ({ userId: result.payment.userId, notice })));
  return result;
}

/** SQL fragments used by the admin lists. */
export const aggregates = (today: string) => ({
  paidCount: sql<number>`count(*) filter (where ${instalments.status} = 'paid')::int`,
  paidAmount: sql<number>`coalesce(sum(${instalments.amount}) filter (where ${instalments.status} = 'paid'), 0)::int`,
  verifyingCount: sql<number>`count(*) filter (where ${instalments.status} = 'submitted')::int`,
  verifyingAmount: sql<number>`coalesce(sum(${instalments.amount}) filter (where ${instalments.status} = 'submitted'), 0)::int`,
  overdueCount: sql<number>`count(*) filter (where ${instalments.status} = 'pending' and ${instalments.dueDate} < ${today}::date)::int`,
  lateCount: sql<number>`count(*) filter (where ${instalments.status} = 'paid' and ${instalments.onTime} = false)::int`,
  totalCount: sql<number>`count(*)::int`,
});

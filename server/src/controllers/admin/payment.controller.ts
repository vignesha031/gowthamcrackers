import { and, asc, count, desc, eq, gte, ilike, lt, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '../../db';
import { admins, enrolments, instalments, payments, plans, users } from '../../db/schema';
import { addDays, istStart } from '../../lib/dates';
import { meta, paging, param, wrap } from '../../lib/http';
import { logActivity } from '../../services/activity';
import { confirmPayment, recordCash, rejectPayment } from '../../services/chit';

/** GET /admin/payments?status=submitted|confirmed|rejected&method=&q=&from=&to=&page= — "submitted" is the verification queue (oldest first) */
export const listPayments = wrap(async (req, res) => {
  const p = paging(req.query);
  const f = z.object({ status: z.enum(['submitted', 'confirmed', 'rejected']).optional(), method: z.enum(['upi', 'bank', 'cash']).optional(), q: z.string().trim().optional(), from: z.string().optional(), to: z.string().optional() }).parse(req.query);
  const where = and(
    f.status ? eq(payments.status, f.status) : undefined, f.method ? eq(payments.method, f.method) : undefined,
    f.q ? or(ilike(payments.ref, `%${f.q}%`), ilike(users.name, `%${f.q}%`), ilike(users.mobile, `%${f.q}%`), ilike(payments.utr, `%${f.q}%`)) : undefined,
    f.from ? gte(payments.createdAt, istStart(f.from)) : undefined, f.to ? lt(payments.createdAt, istStart(addDays(f.to, 1))) : undefined,
  );
  const rec = alias(admins, 'rec'), rev = alias(admins, 'rev');
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      p: payments, customerId: users.id, customerNo: users.customerNo, name: users.name, mobile: users.mobile, enrolNo: enrolments.enrolNo, planN: plans.n,
      no: instalments.no, month: instalments.month, dueDate: instalments.dueDate, receivedBy: rec.name, reviewedBy: rev.name,
    }).from(payments).innerJoin(users, eq(payments.userId, users.id)).innerJoin(enrolments, eq(payments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id))
      .innerJoin(instalments, eq(payments.instalmentId, instalments.id)).leftJoin(rec, eq(rec.id, payments.receivedBy)).leftJoin(rev, eq(rev.id, payments.reviewedBy))
      .where(where).orderBy(f.status === 'submitted' ? asc(payments.createdAt) : desc(payments.createdAt)).limit(p.limit).offset(p.offset),
    db.select({ total: count() }).from(payments).innerJoin(users, eq(payments.userId, users.id)).where(where),
  ]);
  res.json({
    items: rows.map(({ p: x, ...r }) => ({ id: x.id, ref: x.ref, amount: x.amount, method: x.method, utr: x.utr, status: x.status, paidOn: x.paidOn, rejectReason: x.rejectReason, note: x.note, createdAt: x.createdAt, reviewedAt: x.reviewedAt, late: x.paidOn > r.dueDate, ...r })),
    pagination: meta(p, total),
  });
});

/** POST /admin/payments/:id/confirm { paidOn? } — the money reached the shop's account. paidOn lets you correct the date if the customer paid earlier. */
export const confirm = wrap(async (req, res) => {
  const b = z.object({ paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
  const r = await confirmPayment(param(req, 'id'), req.auth!.sub, b.paidOn);
  await logActivity(req, 'payment.confirm', 'payment', r.payment.id, { ref: r.payment.ref, amount: r.payment.amount, paidOn: r.payment.paidOn, onTime: r.instalment.onTime });
  res.json({ ok: true, onTime: r.instalment.onTime, completed: r.completed });
});

/** POST /admin/payments/:id/reject { reason } */
export const reject = wrap(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(200) }).parse(req.body);
  const p = await rejectPayment(param(req, 'id'), req.auth!.sub, reason);
  await logActivity(req, 'payment.reject', 'payment', p.id, { ref: p.ref, reason });
  res.json({ ok: true });
});

/** POST /admin/payments/cash { enrolmentId, instalmentNo?, paidOn?, note? } — cash taken at the shop counter */
export const cash = wrap(async (req, res) => {
  const b = z.object({ enrolmentId: z.string().uuid(), instalmentNo: z.coerce.number().int().min(1).max(60).optional(), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().trim().max(200).optional() }).parse(req.body);
  const r = await recordCash(req.auth!.sub, b.enrolmentId, b);
  await logActivity(req, 'payment.cash', 'payment', r.payment.id, { ref: r.payment.ref, amount: r.payment.amount, enrolmentId: b.enrolmentId });
  res.status(201).json({ ref: r.payment.ref, amount: r.payment.amount, onTime: r.instalment.onTime, completed: r.completed });
});

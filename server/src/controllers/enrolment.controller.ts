import { desc, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { enrolments, instalments, payments, plans } from '../db/schema';
import { HttpError, idempotencyKey, param, wrap } from '../lib/http';
import { joinPlan, loadEnrolments, submitPayment } from '../services/chit';

/** GET /enrolments — my plans, each with every instalment and its state */
export const myEnrolments = wrap(async (req, res) => {
  res.json({ items: await loadEnrolments(eq(enrolments.userId, req.auth!.sub)) });
});

/** GET /enrolments/:id */
export const enrolmentDetail = wrap(async (req, res) => {
  const [e] = await loadEnrolments(and(eq(enrolments.id, param(req, 'id')), eq(enrolments.userId, req.auth!.sub)));
  if (!e) throw new HttpError(404, 'Plan not found');
  res.json(e);
});

/** POST /enrolments { planId } — join a plan (user must have given their name first) */
export const join = wrap(async (req, res) => {
  const { planId } = z.object({ planId: z.string().uuid() }).parse(req.body);
  const e = await joinPlan(req.auth!.sub, planId);
  const [dto] = await loadEnrolments(eq(enrolments.id, e.id));
  res.status(201).json(dto);
});

/** POST /enrolments/:id/payments { method: 'upi'|'bank', utr? } — "I have paid" for the next instalment */
export const pay = wrap(async (req, res) => {
  const b = z.object({ method: z.enum(['upi', 'bank']), utr: z.string().trim().max(40).optional() }).parse(req.body);
  const r = await submitPayment(req.auth!.sub, param(req, 'id'), { ...b, idempotencyKey: idempotencyKey(req) });
  const [e] = await loadEnrolments(eq(enrolments.id, r.payment.enrolmentId));
  res.status(r.duplicate ? 200 : 201).json({ payment: { id: r.payment.id, ref: r.payment.ref, amount: r.payment.amount, paidOn: r.payment.paidOn, status: r.payment.status }, enrolment: e });
});

/** GET /payments — every payment I made, newest first */
export const history = wrap(async (req, res) => {
  const rows = await db.select({ p: payments, planN: plans.n, no: instalments.no, month: instalments.month, dueDate: instalments.dueDate })
    .from(payments).innerJoin(instalments, eq(payments.instalmentId, instalments.id)).innerJoin(enrolments, eq(payments.enrolmentId, enrolments.id)).innerJoin(plans, eq(enrolments.planId, plans.id))
    .where(eq(payments.userId, req.auth!.sub)).orderBy(desc(payments.createdAt)).limit(200);
  res.json({ items: rows.map(({ p, ...r }) => ({ id: p.id, ref: p.ref, amount: p.amount, method: p.method, status: p.status, paidOn: p.paidOn, rejectReason: p.rejectReason, createdAt: p.createdAt, ...r })) });
});

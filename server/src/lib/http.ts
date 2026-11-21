import { count, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, z } from 'zod';
import { db } from '../db';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => { fn(req, res).catch(next); };

/** One place that turns every kind of failure into a clean JSON error the app can show. */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const send = (status: number, error: string, extra: object = {}) => void res.status(status).json({ error, requestId: req.id, ...extra });
  if (res.headersSent) return;
  if (err instanceof ZodError) return send(400, err.issues[0]?.message ?? 'Please check the details you entered', { details: z.flattenError(err).fieldErrors });
  if (err instanceof HttpError) return send(err.status, err.message, err.code ? { code: err.code } : {});
  if (err?.type === 'entity.parse.failed') return send(400, 'Request body is not valid JSON');
  if (err?.type === 'entity.too.large') return send(413, 'Request is too large');
  const pg = err?.cause?.code ?? err?.code; // drizzle wraps the pg error in `cause`
  if (pg === '23505') return send(409, 'This record already exists');
  if (pg === '23503') return send(400, 'A related record was not found');
  if (pg === '22P02' || pg === '22007' || pg === '22003') return send(400, 'A value in the request is invalid');
  if (pg === '40001' || pg === '40P01') return send(503, 'The system is busy, please try again');
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '53300'].includes(pg)) return send(503, 'Service is temporarily unavailable');
  console.error(JSON.stringify({ id: req.id, error: String(err?.stack ?? err) }));
  send(500, 'Something went wrong. Please try again.');
};

/** ?page=1&limit=20 (limit capped at 100) */
export const paging = (q: Request['query']) => {
  const limit = Math.min(Math.max(Math.trunc(Number(q.limit)) || 20, 1), 100);
  const page = Math.min(Math.max(Math.trunc(Number(q.page)) || 1, 1), 100_000);
  return { limit, page, offset: (page - 1) * limit };
};
/** Every list answers { items, pagination: { page, limit, total, totalPages, hasNext, hasPrev } } */
export const meta = (p: { page: number; limit: number }, total: number) => ({
  page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)), hasNext: p.page * p.limit < total, hasPrev: p.page > 1,
});
export async function countOf(table: PgTable, where?: SQL) {
  const [r] = await db.select({ n: count() }).from(table).where(where);
  return r.n;
}
export const param = (req: Request, k: string) => String(req.params[k]);
/** Optional `Idempotency-Key` header: the app sends one per tap so a retried request never creates two payments. */
export const idempotencyKey = (req: Request) => { const k = String(req.headers['idempotency-key'] ?? '').trim(); return k.length >= 8 && k.length <= 64 ? k : undefined; };
/** Escape one CSV cell (and neutralise spreadsheet formulas such as =HYPERLINK()). */
export const csvCell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };

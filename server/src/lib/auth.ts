import type { Request, RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { admins, users } from '../db/schema';
import { HttpError } from './http';
import { can } from './permissions';

export type Auth = { sub: string; kind: 'user' | 'admin'; role?: string; perms?: string[] };
declare global { namespace Express { interface Request { auth?: Auth; id?: string } } }

const secret = () => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET is not set'); return s; };
export const sign = (a: Pick<Auth, 'sub' | 'kind'>, expiresIn: string) => jwt.sign({ sub: a.sub, kind: a.kind }, secret(), { expiresIn } as jwt.SignOptions);

const read = (req: Request): Auth => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw new HttpError(401, 'Please log in', 'AUTH_REQUIRED');
  try { return jwt.verify(h.slice(7), secret()) as Auth; } catch { throw new HttpError(401, 'Session expired, please log in again', 'SESSION_EXPIRED'); }
};

// Role / permissions / blocked state are read from the DB (cached 30 s), never trusted from the token:
// removing someone's access, or blocking a customer, takes effect within 30 seconds.
type Seen = { ok: boolean; role?: string; perms?: string[]; mustChange?: boolean; exp: number };
const seen = new Map<string, Seen>();
export const forgetAuth = (id: string) => { seen.delete(`user:${id}`); seen.delete(`admin:${id}`); };
async function lookup(a: Auth): Promise<Seen> {
  const key = `${a.kind}:${a.sub}`, hit = seen.get(key);
  if (hit && hit.exp > Date.now()) return hit;
  let s: Seen;
  if (a.kind === 'user') {
    const [u] = await db.select({ b: users.blocked, d: users.deletedAt }).from(users).where(eq(users.id, a.sub));
    s = { ok: !!u && !u.b && !u.d, exp: 0 };
  } else {
    const [x] = await db.select({ on: admins.active, role: admins.role, perms: admins.permissions, mc: admins.mustChangePassword }).from(admins).where(eq(admins.id, a.sub));
    s = { ok: !!x?.on, role: x?.role, perms: x?.perms, mustChange: x?.mc, exp: 0 };
  }
  if (seen.size > 20_000) seen.clear();
  s.exp = Date.now() + 30_000;
  seen.set(key, s);
  return s;
}

const guard = (kind: Auth['kind'], perm?: string): RequestHandler => async (req, _res, next) => {
  try {
    const a = read(req);
    if (a.kind !== kind) throw new HttpError(403, 'Forbidden');
    const s = await lookup(a);
    if (!s.ok) throw new HttpError(403, 'This account is disabled. Please contact the store.', 'ACCOUNT_DISABLED');
    if (kind === 'admin') {
      a.role = s.role; a.perms = s.perms;
      const open = /\/admin\/(me|auth\/change-password)$/.test(req.originalUrl.split('?')[0]);
      if (s.mustChange && !open) throw new HttpError(403, 'Please set a new password first', 'PASSWORD_CHANGE_REQUIRED');
      if (perm && !can(a, perm)) throw new HttpError(403, 'You do not have access to this section', 'NO_PERMISSION');
    }
    req.auth = a;
    next();
  } catch (e) { next(e); }
};
export const requireUser = guard('user');
export const requireAdmin = guard('admin');                       // any logged-in staff member
export const requirePerm = (perm: string) => guard('admin', perm); // e.g. requirePerm('payments.manage')

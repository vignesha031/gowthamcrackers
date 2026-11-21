import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { admins, otps, users } from '../db/schema';
import { sign } from '../lib/auth';
import { HttpError, wrap } from '../lib/http';
import { effective } from '../lib/permissions';
import { logActivity } from '../services/activity';
import { sendOtpSms, smsIsReal } from '../services/sms';

export const otpLength = () => Math.min(Math.max(Number(process.env.OTP_LENGTH) || 4, 4), 8);
const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const sha = (s: string) => crypto.createHash('sha256').update(s + (process.env.OTP_PEPPER ?? '')).digest('hex');
const isTestLogin = (m: string, code?: string) => !!process.env.TEST_MOBILE && !!process.env.TEST_OTP && m === process.env.TEST_MOBILE && (code === undefined || code === process.env.TEST_OTP);

/** POST /auth/otp  { mobile } */
export const sendOtp = wrap(async (req, res) => {
  const { mobile: m } = z.object({ mobile }).parse(req.body);
  if (isTestLogin(m)) return void res.json({ sent: true, length: process.env.TEST_OTP!.length });
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(otps).where(and(eq(otps.mobile, m), gt(otps.createdAt, sql`now() - interval '10 minutes'`)));
  if (n >= 5) throw new HttpError(429, 'Too many OTP requests. Try again in a few minutes.');
  const [last] = await db.select({ at: otps.createdAt }).from(otps).where(eq(otps.mobile, m)).orderBy(desc(otps.createdAt)).limit(1);
  if (last && Date.now() - +last.at < 30_000) throw new HttpError(429, 'Please wait 30 seconds before asking for another OTP.');
  const len = otpLength();
  const code = String(crypto.randomInt(10 ** (len - 1), 10 ** len));
  await db.insert(otps).values({ mobile: m, codeHash: sha(m + code), expiresAt: new Date(Date.now() + 5 * 60_000) });
  await sendOtpSms(m, code);
  // development convenience only: the app shows this so you can test without an SMS provider
  res.json({ sent: true, length: len, ...(!smsIsReal() && process.env.NODE_ENV !== 'production' && { devOtp: code }) });
});

/** POST /auth/verify  { mobile, code } → token. Creates the customer on first login. */
export const verifyOtp = wrap(async (req, res) => {
  const { mobile: m, code } = z.object({ mobile, code: z.string().regex(/^\d{4,8}$/, 'Enter the OTP') }).parse(req.body);
  if (!isTestLogin(m, code)) {
    const [o] = await db.select().from(otps).where(and(eq(otps.mobile, m), isNull(otps.consumedAt), gt(otps.expiresAt, new Date()))).orderBy(desc(otps.createdAt)).limit(1);
    if (!o || o.attempts >= 5) throw new HttpError(400, 'OTP expired. Please request a new one.');
    if (o.codeHash !== sha(m + code)) {
      await db.update(otps).set({ attempts: sql`${otps.attempts} + 1` }).where(eq(otps.id, o.id));
      throw new HttpError(400, 'Incorrect OTP');
    }
    await db.update(otps).set({ consumedAt: new Date() }).where(eq(otps.id, o.id));
  }
  const u = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.mobile, m));
    if (existing) { const [x] = await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id)).returning(); return x; }
    const [created] = await tx.insert(users).values({ mobile: m, lastLoginAt: new Date() }).onConflictDoNothing().returning();
    if (!created) { const [x] = await tx.select().from(users).where(eq(users.mobile, m)); return x; }
    const [x] = await tx.update(users).set({ referralCode: `GC${1000 + created.customerNo}` }).where(eq(users.id, created.id)).returning();
    return x;
  });
  if (u.blocked) throw new HttpError(403, 'This account has been blocked. Please contact the store.');
  res.json({ token: sign({ sub: u.id, kind: 'user' }, '60d'), isNew: !u.name });
});

/** POST /admin/auth/login  { email, password } */
export const adminLogin = wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const [a] = await db.select().from(admins).where(eq(admins.email, email.toLowerCase()));
  if (!a || !a.active || !(await bcrypt.compare(password, a.passwordHash))) throw new HttpError(401, 'Wrong email or password');
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, a.id));
  req.auth = { sub: a.id, kind: 'admin', role: a.role };
  await logActivity(req, 'login', 'admin', a.id);
  res.json({ token: sign({ sub: a.id, kind: 'admin' }, '12h'), admin: { id: a.id, name: a.name, role: a.role, permissions: effective(a.role, a.permissions), mustChangePassword: a.mustChangePassword } });
});

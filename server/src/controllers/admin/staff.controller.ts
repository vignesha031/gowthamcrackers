import bcrypt from 'bcryptjs';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '../../db';
import { activityLogs, admins } from '../../db/schema';
import { type Auth, forgetAuth } from '../../lib/auth';
import { HttpError, countOf, meta, paging, param, wrap } from '../../lib/http';
import { ALL_PERMISSIONS, PRESETS, SECTIONS, can, effective } from '../../lib/permissions';
import { logActivity } from '../../services/activity';

const RANK: Record<string, number> = { super_admin: 3, admin: 2, staff: 1 };
const rank = (r?: string) => RANK[r ?? ''] ?? 0;
const permList = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length);
const password = z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
const cols = { id: admins.id, name: admins.name, email: admins.email, phone: admins.phone, role: admins.role, permissions: admins.permissions, active: admins.active, mustChangePassword: admins.mustChangePassword, lastLoginAt: admins.lastLoginAt, createdAt: admins.createdAt, createdBy: admins.createdBy };

/** You may manage only people below you that you created (super admin: everyone). Nobody edits their own access. */
function assertCanManage(actor: Auth, t: { id: string; role: string; createdBy: string | null }) {
  if (t.id === actor.sub) throw new HttpError(400, 'You cannot change your own access. Ask the owner.');
  if (actor.role === 'super_admin') return;
  if (rank(actor.role) > rank(t.role) && t.createdBy === actor.sub) return;
  throw new HttpError(403, 'You can only manage staff you added');
}
/** No privilege escalation: you can only hand out access you hold yourself. */
function assertCanGrant(actor: Auth, perms: string[]) {
  const bad = perms.filter((p) => !can(actor, p));
  if (bad.length) throw new HttpError(403, `You cannot give access you do not have: ${bad.join(', ')}`);
}
const load = async (id: string) => { const [t] = await db.select().from(admins).where(eq(admins.id, id)); if (!t) throw new HttpError(404, 'Staff member not found'); return t; };

/** GET /admin/me — who am I, what can I open (drives the sidebar) */
export const me = wrap(async (req, res) => {
  const a = await load(req.auth!.sub);
  res.json({ id: a.id, name: a.name, email: a.email, role: a.role, permissions: effective(a.role, a.permissions), mustChangePassword: a.mustChangePassword });
});

/** GET /admin/permissions — sections, what I may hand out, and ready-made presets for the "add staff" screen */
export const catalog = wrap(async (req, res) => {
  res.json({
    sections: Object.entries(SECTIONS).map(([key, label]) => ({ key, label })),
    grantable: ALL_PERMISSIONS.filter((p) => can(req.auth, p)),
    creatableRoles: ['admin', 'staff'].filter((r) => rank(req.auth!.role) > rank(r)),
    presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.filter((p) => can(req.auth, p))])),
  });
});

/** GET /admin/staff — super admin sees everyone, an admin sees the people they added */
export const listStaff = wrap(async (req, res) => {
  const p = paging(req.query), creator = alias(admins, 'creator');
  const f = z.object({ q: z.string().optional(), active: z.enum(['true', 'false']).optional() }).parse(req.query);
  const where = and(
    req.auth!.role === 'super_admin' ? sql`${admins.id} <> ${req.auth!.sub}` : eq(admins.createdBy, req.auth!.sub),
    f.q ? or(ilike(admins.name, `%${f.q}%`), ilike(admins.email, `%${f.q}%`)) : undefined, f.active ? eq(admins.active, f.active === 'true') : undefined,
  );
  const [items, total] = await Promise.all([
    db.select({ ...cols, addedBy: creator.name }).from(admins).leftJoin(creator, eq(creator.id, admins.createdBy)).where(where).orderBy(desc(admins.createdAt)).limit(p.limit).offset(p.offset),
    countOf(admins, where),
  ]);
  res.json({ items, pagination: meta(p, total) });
});

/** POST /admin/staff — add a person and choose exactly which sections they can open */
export const createStaff = wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(2).max(120), email: z.string().email(), phone: z.string().regex(/^[6-9]\d{9}$/).optional(), password, role: z.enum(['admin', 'staff']), permissions: permList }).parse(req.body);
  const actor = req.auth!;
  if (rank(actor.role) <= rank(b.role)) throw new HttpError(403, `You cannot add someone with the "${b.role}" role`);
  assertCanGrant(actor, b.permissions);
  const email = b.email.toLowerCase();
  if ((await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email))).length) throw new HttpError(409, 'This email is already used by another staff member');
  const [a] = await db.insert(admins).values({ name: b.name, email, phone: b.phone, role: b.role, permissions: b.permissions, passwordHash: await bcrypt.hash(b.password, 10), createdBy: actor.sub, mustChangePassword: true }).returning(cols);
  await logActivity(req, 'staff.create', 'admin', a.id, { role: b.role, permissions: b.permissions });
  res.status(201).json(a);
});

/** PATCH /admin/staff/:id — change name / phone / role / sections / switch off */
export const updateStaff = wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(2).max(120), phone: z.string().regex(/^[6-9]\d{9}$/), role: z.enum(['admin', 'staff']), permissions: permList, active: z.boolean() }).partial().parse(req.body);
  const actor = req.auth!, t = await load(param(req, 'id'));
  assertCanManage(actor, t);
  if (b.role && rank(actor.role) <= rank(b.role)) throw new HttpError(403, `You cannot give the "${b.role}" role`);
  if (b.permissions) assertCanGrant(actor, b.permissions);
  const [a] = await db.update(admins).set(b).where(eq(admins.id, t.id)).returning(cols);
  forgetAuth(t.id); // takes effect immediately
  await logActivity(req, 'staff.update', 'admin', t.id, b);
  res.json(a);
});

/** POST /admin/staff/:id/reset-password  { password } — they must pick a new one at next login */
export const resetPassword = wrap(async (req, res) => {
  const { password: pw } = z.object({ password }).parse(req.body);
  const actor = req.auth!, t = await load(param(req, 'id'));
  assertCanManage(actor, t);
  await db.update(admins).set({ passwordHash: await bcrypt.hash(pw, 10), mustChangePassword: true }).where(eq(admins.id, t.id));
  forgetAuth(t.id);
  await logActivity(req, 'staff.reset_password', 'admin', t.id);
  res.json({ ok: true });
});

/** POST /admin/auth/change-password */
export const changePassword = wrap(async (req, res) => {
  const b = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(req.body);
  const a = await load(req.auth!.sub);
  if (!(await bcrypt.compare(b.currentPassword, a.passwordHash))) throw new HttpError(400, 'Current password is wrong');
  if (b.currentPassword === b.newPassword) throw new HttpError(400, 'Choose a different password');
  await db.update(admins).set({ passwordHash: await bcrypt.hash(b.newPassword, 10), mustChangePassword: false }).where(eq(admins.id, a.id));
  forgetAuth(a.id);
  res.json({ ok: true });
});

/** GET /admin/staff/:id/activity */
export const staffActivity = wrap(async (req, res) => {
  const p = paging(req.query), t = await load(param(req, 'id'));
  if (t.id !== req.auth!.sub) assertCanManage(req.auth!, t);
  const where = eq(activityLogs.adminId, t.id);
  const [items, total] = await Promise.all([
    db.select({ id: activityLogs.id, action: activityLogs.action, entity: activityLogs.entity, entityId: activityLogs.entityId, meta: activityLogs.meta, at: activityLogs.createdAt }).from(activityLogs).where(where).orderBy(desc(activityLogs.createdAt)).limit(p.limit).offset(p.offset),
    countOf(activityLogs, where),
  ]);
  res.json({ items, pagination: meta(p, total) });
});

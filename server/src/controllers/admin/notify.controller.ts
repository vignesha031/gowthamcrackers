import { and, eq, exists, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { enrolments, instalments, plans, users } from '../../db/schema';
import { istToday } from '../../lib/dates';
import { wrap } from '../../lib/http';
import { logActivity } from '../../services/activity';
import { notifyMany } from '../../services/notify';
import { sendPushToUsers } from '../../services/push';

const audience = z.object({ audience: z.enum(['all', 'members', 'overdue', 'completed', 'plan']), planN: z.number().int().optional() }).refine((v) => v.audience !== 'plan' || v.planN, { message: 'Choose a plan', path: ['planN'] });

async function recipients(a: z.infer<typeof audience>) {
  const base = and(eq(users.blocked, false), isNull(users.deletedAt));
  const member = (extra?: ReturnType<typeof eq>) => exists(db.select({ x: sql`1` }).from(enrolments).innerJoin(plans, eq(enrolments.planId, plans.id)).where(and(eq(enrolments.userId, users.id), extra)));
  const where = a.audience === 'all' ? base
    : a.audience === 'members' ? and(base, member())
    : a.audience === 'completed' ? and(base, member(eq(enrolments.status, 'completed')))
    : a.audience === 'plan' ? and(base, member(eq(plans.n, a.planN!)))
    : and(base, exists(db.select({ x: sql`1` }).from(instalments).innerJoin(enrolments, eq(instalments.enrolmentId, enrolments.id)).where(and(eq(enrolments.userId, users.id), eq(instalments.status, 'pending'), eq(enrolments.status, 'active'), sql`${instalments.dueDate} < ${istToday()}::date`))));
  return (await db.select({ id: users.id }).from(users).where(where)).map((r) => r.id);
}

/** POST /admin/notifications/audience — "how many people will get this?" */
export const audienceCount = wrap(async (req, res) => { res.json({ count: (await recipients(audience.parse(req.body))).length }); });

/** POST /admin/notifications/broadcast — a message in every chosen customer's in-app inbox */
export const broadcast = wrap(async (req, res) => {
  const b = audience.and(z.object({
    kind: z.enum(['offers', 'general']).default('general'), titleTa: z.string().trim().min(1).max(100), titleEn: z.string().trim().min(1).max(100),
    bodyTa: z.string().trim().min(1).max(500), bodyEn: z.string().trim().min(1).max(500),
  })).parse(req.body);
  const ids = await recipients(b);
  const notice = { kind: b.kind, titleTa: b.titleTa, titleEn: b.titleEn, bodyTa: b.bodyTa, bodyEn: b.bodyEn } as const;
  const sent = await notifyMany(db, ids, notice);
  await sendPushToUsers(ids, notice);
  await logActivity(req, 'notification.broadcast', 'notification', undefined, { audience: b.audience, planN: b.planN, sent, titleEn: b.titleEn });
  res.json({ sent });
});

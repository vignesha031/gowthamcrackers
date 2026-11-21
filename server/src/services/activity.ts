import type { Request } from 'express';
import { db } from '../db';
import { activityLogs } from '../db/schema';

/** Audit trail for every staff action (shown on the admin "Activity" page). */
export async function logActivity(req: Request, action: string, entity: string, entityId?: string, meta?: object) {
  if (req.auth?.kind !== 'admin') return;
  try { await db.insert(activityLogs).values({ adminId: req.auth.sub, action, entity, entityId, meta, ip: req.ip }); }
  catch (e) { console.error('activity log failed', e); }
}

import { notifications } from '../db/schema';
import type { Db } from '../db';

export type Notice = { kind: 'payments' | 'dues' | 'offers' | 'delivery' | 'general'; titleTa: string; titleEn: string; bodyTa: string; bodyEn: string };

/** Puts a message in one customer's in-app inbox. */
export const notifyOne = (db: Db, userId: string, n: Notice) => db.insert(notifications).values({ userId, ...n });

/** Same message for many customers (chunked so a big broadcast never builds one giant statement). */
export async function notifyMany(db: Db, userIds: string[], n: Notice) {
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);
    if (chunk.length) await db.insert(notifications).values(chunk.map((userId) => ({ userId, ...n })));
  }
  return userIds.length;
}
export const inr = (n: number) => n.toLocaleString('en-IN');

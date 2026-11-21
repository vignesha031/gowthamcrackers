import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { inArray, eq } from 'drizzle-orm';
import { db } from '../db';
import { pushTokens, users } from '../db/schema';
import type { Notice } from './notify';

function messaging() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const account = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required service account fields');
  const app = getApps().find((item) => item.name === 'gowtham-fcm') ?? initializeApp({
    credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key }),
    projectId: account.project_id,
  }, 'gowtham-fcm');
  return getMessaging(app);
}

export type PushDispatch = { userId: string; notice: Notice };

/** Sends after inbox writes commit; absent credentials leave in-app notifications working normally. */
export async function sendPushMessages(dispatches: PushDispatch[]) {
  if (!dispatches.length) return 0;
  try {
    const fcm = messaging();
    if (!fcm) return 0;
    const notices = new Map<string, Notice[]>();
    for (const dispatch of dispatches) notices.set(dispatch.userId, [...(notices.get(dispatch.userId) ?? []), dispatch.notice]);
    let delivered = 0;
    const userIds = [...notices.keys()];
    const messages: Array<Message & { token: string }> = [];
    for (let offset = 0; offset < userIds.length; offset += 500) {
      const batchIds = userIds.slice(offset, offset + 500);
      const devices = await db.select({ token: pushTokens.token, userId: pushTokens.userId, lang: users.lang })
        .from(pushTokens).innerJoin(users, eq(pushTokens.userId, users.id)).where(inArray(pushTokens.userId, batchIds));
      for (const device of devices) {
        const userNotices = notices.get(device.userId);
        if (!userNotices) continue;
        const lang = device.lang === 'ta' ? 'ta' : 'en';
        for (const notice of userNotices) messages.push({
            token: device.token,
            notification: { title: lang === 'ta' ? notice.titleTa : notice.titleEn, body: lang === 'ta' ? notice.bodyTa : notice.bodyEn },
            data: { kind: notice.kind, route: '/notifications' },
            android: { notification: { channelId: 'default', color: '#E6B84A' } },
        });
      }
    }
    for (let offset = 0; offset < messages.length; offset += 500) {
      const chunk = messages.slice(offset, offset + 500);
      const response = await fcm.sendEach(chunk);
      delivered += response.successCount;
      const invalid = response.responses.flatMap((result, index) => !result.success &&
        ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.error?.code ?? '')
        ? [chunk[index].token] : []);
      if (invalid.length) await db.delete(pushTokens).where(inArray(pushTokens.token, invalid));
      }
    return delivered;
  } catch (error) {
    console.error('[push] FCM delivery failed:', error instanceof Error ? error.message : 'Unknown error');
    return 0;
  }
}

export const sendPushToUsers = (userIds: string[], notice: Notice) => sendPushMessages(userIds.map((userId) => ({ userId, notice })));

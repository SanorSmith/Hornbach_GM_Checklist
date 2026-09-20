import webpush from 'web-push';
import { repository } from '@/lib/repo';
import type { PendingNotification } from './detect';

/**
 * Sends the notifications the scheduled check produced to people's devices.
 *
 * Push is best-effort by design. A subscription can be dead, a phone can be
 * off, a push service can be down — and none of that should fail the thing that
 * actually matters, which is the notification row being recorded. The in-app
 * banner is the reliable channel; push is what makes it timely.
 */

let configured = false;

/** Returns false when the keys are absent, which is how push stays optional. */
function configure(): boolean {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:gm@hornbach.se';
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushIsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const TITLE = 'GM Checklista';

function messageFor(item: PendingNotification): { title: string; body: string; tag: string } {
  const list = item.payload.listName;
  const body =
    item.kind === 'NOT_SIGNED_BY_END'
      ? `${list} är inte signerad.`
      : `${list} är inte påbörjad.`;

  return {
    title: TITLE,
    // Tagged per list and kind so a repeat replaces the earlier notification in
    // the tray rather than stacking another copy of the same sentence.
    body: item.payload.assigneeName ? `${body} Tilldelad ${item.payload.assigneeName}.` : body,
    tag: `${item.templateCode}:${item.kind}`,
  };
}

export interface PushResult {
  sent: number;
  failed: number;
  pruned: number;
}

/**
 * Delivers one push per subscription of each recipient.
 *
 * Endpoints the push service reports as gone (404/410) are deleted: a dead
 * subscription retried forever is the main way this kind of table rots.
 */
export async function sendPushes(items: readonly PendingNotification[]): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (items.length === 0 || !configure()) return result;

  const repo = repository();
  const recipientIds = [...new Set(items.map((i) => i.recipientId))];
  const subscriptions = await repo.listPushSubscriptions(recipientIds);
  if (subscriptions.length === 0) return result;

  const byUser = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    byUser.set(sub.userId, [...(byUser.get(sub.userId) ?? []), sub]);
  }

  await Promise.all(
    items.flatMap((item) => {
      const targets = byUser.get(item.recipientId) ?? [];
      const message = messageFor(item);

      return targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({ ...message, url: '/gpl' }),
            { TTL: 60 * 60 },
          );
          result.sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await repo.deletePushSubscription(sub.endpoint);
            result.pruned += 1;
          } else {
            result.failed += 1;
          }
        }
      });
    }),
  );

  return result;
}

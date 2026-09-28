import type { PushSubscriptionInput } from "@workspace/shared/push"

export async function listNotificationDevices(
  db: D1Database,
  memberId: string
) {
  const rows = await db
    .prepare(
      "SELECT id,endpoint,enabled FROM notification_devices WHERE member_id=?"
    )
    .bind(memberId)
    .all<{ id: string; endpoint: string | null; enabled: number }>()
  return rows.results.map((row) => ({ ...row, enabled: row.enabled === 1 }))
}
export async function saveNotificationPreference(
  db: D1Database,
  memberId: string,
  id: string,
  enabled: boolean
) {
  const now = Date.now()
  const result = await db
    .prepare(
      `INSERT INTO notification_devices(id,member_id,enabled,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at WHERE notification_devices.member_id=excluded.member_id`
    )
    .bind(id, memberId, enabled ? 1 : 0, now, now)
    .run()
  return result.meta.changes === 1
}
export async function saveDeviceSubscription(
  db: D1Database,
  memberId: string,
  id: string,
  sub: PushSubscriptionInput
) {
  const result = await db
    .prepare(
      "UPDATE notification_devices SET endpoint=?,expiration_time=?,p256dh=?,auth=?,updated_at=? WHERE id=? AND member_id=? AND NOT EXISTS(SELECT 1 FROM notification_devices other WHERE other.endpoint=? AND other.id<>?)"
    )
    .bind(
      sub.endpoint,
      sub.expirationTime,
      sub.keys.p256dh,
      sub.keys.auth,
      Date.now(),
      id,
      memberId,
      sub.endpoint,
      id
    )
    .run()
  return result.meta.changes === 1
}
export async function clearPushTransport(
  db: D1Database,
  id: string,
  endpoint: string
) {
  await db
    .prepare(
      "UPDATE notification_devices SET endpoint=NULL,expiration_time=NULL,p256dh=NULL,auth=NULL WHERE id=? AND endpoint=?"
    )
    .bind(id, endpoint)
    .run()
}

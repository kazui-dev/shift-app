import type { PushSubscriptionInput } from "@workspace/shared/communications"

export async function listPushSubscriptions(db: D1Database, memberId: string) {
  const result = await db
    .prepare(
      "SELECT endpoint, enabled FROM push_subscriptions WHERE member_id=? AND endpoint IS NOT NULL"
    )
    .bind(memberId)
    .all<{ endpoint: string; enabled: number }>()
  return result.results.map((row) => ({
    endpoint: row.endpoint,
    enabled: row.enabled === 1,
  }))
}
export async function savePushSubscription(
  db: D1Database,
  memberId: string,
  sub: PushSubscriptionInput
) {
  const now = Date.now()
  const result = await db
    .prepare(`INSERT INTO push_subscriptions (id,member_id,enabled,endpoint,expiration_time,p256dh,auth,created_at,updated_at)
    VALUES (?,?,1,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET
    enabled=1,expiration_time=excluded.expiration_time,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at
    WHERE push_subscriptions.member_id=excluded.member_id`)
    .bind(
      crypto.randomUUID(),
      memberId,
      sub.endpoint,
      sub.expirationTime,
      sub.keys.p256dh,
      sub.keys.auth,
      now,
      now
    )
    .run()
  return result.meta.changes === 1
}
export async function disablePushSubscription(
  db: D1Database,
  memberId: string,
  endpoint: string
) {
  await db
    .prepare(
      "UPDATE push_subscriptions SET enabled=0,updated_at=? WHERE member_id=? AND endpoint=?"
    )
    .bind(Date.now(), memberId, endpoint)
    .run()
}

export async function clearPushTransport(
  db: D1Database,
  id: string,
  endpoint: string
) {
  await db
    .prepare(
      "UPDATE push_subscriptions SET endpoint=NULL, expiration_time=NULL, p256dh=NULL, auth=NULL WHERE id=? AND endpoint=?"
    )
    .bind(id, endpoint)
    .run()
}

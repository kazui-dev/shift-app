import type {
  PushDevice,
  PushDeviceUpdate,
} from "@workspace/shared/communications"

type Row = {
  id: string
  enabled: number
  endpoint: string | null
  expirationTime: number | null
  p256dh: string | null
  auth: string | null
}
const fields =
  "id, enabled, endpoint, expiration_time AS expirationTime, p256dh, auth"
function device(row: Row): PushDevice {
  return {
    id: row.id,
    enabled: row.enabled === 1,
    subscription:
      row.endpoint && row.p256dh && row.auth
        ? {
            endpoint: row.endpoint,
            expirationTime: row.expirationTime,
            keys: { p256dh: row.p256dh, auth: row.auth },
          }
        : null,
  }
}
export async function getPushDevice(
  db: D1Database,
  memberId: string,
  id: string
) {
  const row = await db
    .prepare(`SELECT ${fields} FROM push_devices WHERE id=? AND member_id=?`)
    .bind(id, memberId)
    .first<Row>()
  return row ? device(row) : null
}
export async function createPushDevice(
  db: D1Database,
  memberId: string,
  endpoint: string | null
): Promise<PushDevice> {
  if (endpoint) {
    const existing = await db
      .prepare(
        `SELECT ${fields} FROM push_devices WHERE endpoint=? AND member_id=?`
      )
      .bind(endpoint, memberId)
      .first<Row>()
    if (existing) return device(existing)
  }
  const id = crypto.randomUUID(),
    now = Date.now()
  await db
    .prepare(
      "INSERT INTO push_devices (id,member_id,enabled,created_at,updated_at) VALUES (?,?,0,?,?)"
    )
    .bind(id, memberId, now, now)
    .run()
  return { id, enabled: false, subscription: null }
}
export async function updatePushDevice(
  db: D1Database,
  memberId: string,
  id: string,
  input: PushDeviceUpdate
) {
  if (!input.enabled) {
    await db
      .prepare(
        "UPDATE push_devices SET enabled=0, updated_at=? WHERE id=? AND member_id=?"
      )
      .bind(Date.now(), id, memberId)
      .run()
  } else {
    const sub = input.subscription
    const result = await db
      .prepare(`UPDATE push_devices SET enabled=1, endpoint=?, expiration_time=?, p256dh=?, auth=?, updated_at=?
      WHERE id=? AND member_id=? AND NOT EXISTS (SELECT 1 FROM push_devices WHERE endpoint=? AND id<>?)`)
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
    if (result.meta.changes !== 1) return null
  }
  return getPushDevice(db, memberId, id)
}

export async function clearPushTransport(
  db: D1Database,
  id: string,
  endpoint: string
) {
  await db
    .prepare(
      "UPDATE push_devices SET endpoint=NULL, expiration_time=NULL, p256dh=NULL, auth=NULL WHERE id=? AND endpoint=?"
    )
    .bind(id, endpoint)
    .run()
}

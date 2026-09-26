import { roomAudience } from "./chat-permissions"
import type { RoomDevice } from "../../notifications/domain/room-device"

export type Reader = { memberId: string; readsPrivate: boolean }

/**
 * Who may read a private message: the member it concerns, and whoever looks
 * after the room's shift — its current responsibles, members with shift
 * management in the year, and system administrators. Responsibility is read
 * when the message is read, so a new responsible also sees earlier notices.
 */

/**
 * A condition true when `member` looks after the shift of `room`. Both are SQL
 * expressions; the condition is false in rooms that belong to no shift.
 */
export function looksAfterShift(member: string, room: string) {
  return `EXISTS(SELECT 1 FROM activity_chat_rooms link
    JOIN activities shift ON shift.id=link.activity_id
    JOIN year_memberships keeper ON keeper.year=shift.year AND keeper.member_id=${member} AND keeper.status='active'
    WHERE link.room_id=${room} AND (
      EXISTS(SELECT 1 FROM app_users admin WHERE admin.id=${member} AND admin.access_level='system_admin')
      OR EXISTS(SELECT 1 FROM activity_responsibles responsible WHERE responsible.activity_id=shift.id
        AND ((responsible.target_type='member' AND responsible.target_id=${member})
        OR (responsible.target_type='role' AND EXISTS(SELECT 1 FROM member_year_roles held
          WHERE held.member_id=${member} AND held.role_id=responsible.target_id))))
      OR EXISTS(SELECT 1 FROM member_year_roles held JOIN year_roles role ON role.id=held.role_id AND role.year=shift.year
        JOIN year_role_permissions granted ON granted.role_id=role.id AND granted.permission='shift.manage'
        WHERE held.member_id=${member})))`
}

/** Whether the member may read every private message in the room. */
export async function readsPrivate(
  env: CloudflareBindings,
  roomId: string,
  memberId: string
) {
  const row = await env.shift_app
    .prepare(`SELECT ${looksAfterShift("?1", "?2")} AS allowed`)
    .bind(memberId, roomId)
    .first<{ allowed: number }>()
  return row?.allowed === 1
}

/**
 * Of the room's members, those who may read a message private to `about`.
 * Responsibles are marked, since their notices ring even when they muted.
 */
export async function privateReaders(
  env: CloudflareBindings,
  roomId: string,
  about: string,
  members: string[]
) {
  const result = await env.shift_app
    .prepare(
      `SELECT member.value AS id,
        EXISTS(SELECT 1 FROM activity_chat_rooms link
          JOIN activity_responsibles responsible ON responsible.activity_id=link.activity_id
          WHERE link.room_id=?1 AND ((responsible.target_type='member' AND responsible.target_id=member.value)
          OR (responsible.target_type='role' AND EXISTS(SELECT 1 FROM member_year_roles held
            WHERE held.member_id=member.value AND held.role_id=responsible.target_id)))) AS responsible
      FROM json_each(?2) member
      WHERE member.value=?3 OR ${looksAfterShift("member.value", "?1")}`
    )
    .bind(roomId, JSON.stringify(members), about)
    .all<{ id: string; responsible: number }>()
  return {
    members: result.results.map((row) => row.id),
    responsibles: new Set(
      result.results.filter((row) => row.responsible === 1).map((row) => row.id)
    ),
  }
}

/**
 * Who a new message reaches and which devices ring. A private message reaches
 * only its readers; a notice that must ring does so for responsibles even in
 * a muted room, as a late or absence notice has to be seen.
 */
export async function messageAudience(
  env: CloudflareBindings,
  roomId: string,
  privateTo: string | null,
  ringResponsibles = false
): Promise<{ members: string[]; devices: RoomDevice[] }> {
  const audience = await roomAudience(env, roomId)
  if (privateTo === null)
    return {
      members: audience.members,
      devices: audience.devices.filter((device) => !device.muted),
    }
  const readers = await privateReaders(env, roomId, privateTo, audience.members)
  const reached = new Set(readers.members)
  return {
    members: readers.members,
    devices: audience.devices.filter(
      (device) =>
        reached.has(device.memberId) &&
        (!device.muted ||
          (ringResponsibles && readers.responsibles.has(device.memberId)))
    ),
  }
}

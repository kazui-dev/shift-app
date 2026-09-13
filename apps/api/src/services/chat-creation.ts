import type { InferOutput } from "valibot"
import type { roomSettingsInputSchema } from "@workspace/shared/communications"

type Grant = InferOutput<typeof roomSettingsInputSchema>["targets"][number]
type Room = {
  id: string
  year: number
  name: string
  createdBy: string
  activityId: string | null
  allowExit: boolean
  targets: Grant[]
}
const grant = (
  targetType: Grant["targetType"],
  targetId: string,
  manage = false,
  post = true
): Grant => ({
  targetType,
  targetId,
  canRead: true,
  canPost: post,
  canManage: manage,
})

export function yearRoom(year: number, createdBy: string): Room {
  return {
    id: crypto.randomUUID(),
    year,
    name: "全体連絡",
    createdBy,
    activityId: null,
    allowExit: false,
    targets: [
      grant("year", String(year), false, false),
      grant("access_level", "system_admin", true),
    ],
  }
}
/** A conversation someone starts, managed by its creator. */
export function memberRoom(
  input: {
    year: number
    name: string
    targets: { targetType: Grant["targetType"]; targetId: string }[]
  },
  createdBy: string
): Room {
  const invited = new Map(
    input.targets.map((target) => [
      `${target.targetType}:${target.targetId}`,
      target,
    ])
  )
  invited.delete(`member:${createdBy}`)
  return {
    id: crypto.randomUUID(),
    year: input.year,
    name: input.name,
    createdBy,
    activityId: null,
    allowExit: true,
    targets: [
      grant("member", createdBy, true),
      ...[...invited.values()].map((target) =>
        grant(target.targetType, target.targetId)
      ),
    ],
  }
}

export function activityRoom(activity: {
  id: string
  year: number
  name: string
  createdBy: string
}): Room {
  return {
    id: crypto.randomUUID(),
    year: activity.year,
    name: activity.name,
    createdBy: activity.createdBy,
    activityId: activity.id,
    allowExit: false,
    targets: [
      grant("activity", activity.id),
      grant("responsible", activity.id, true),
      grant("permission", "shift.manage", true),
      grant("access_level", "system_admin", true),
    ],
  }
}
export function roomCommands(
  room: Room,
  now: number
): { sql: string; params: (string | number | null)[] }[] {
  return [
    {
      sql: `INSERT INTO chat_rooms(id,year,name,created_by,allow_exit,created_at,updated_at)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operating_years WHERE year=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM activities WHERE id=?))`,
      params: [
        room.id,
        room.year,
        room.name,
        room.createdBy,
        room.allowExit ? 1 : 0,
        now,
        now,
        room.year,
        room.activityId,
        room.activityId,
      ],
    },
    ...(room.activityId === null
      ? []
      : [
          {
            sql: "INSERT INTO activity_chat_rooms(activity_id,room_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM chat_rooms WHERE id=?)",
            params: [room.activityId, room.id, room.id],
          },
        ]),
    ...room.targets.map((target) => ({
      sql: `INSERT INTO chat_room_targets(room_id,target_type,target_id,can_read,can_post,can_manage,created_at)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM chat_rooms WHERE id=?)`,
      params: [
        room.id,
        target.targetType,
        target.targetId,
        target.canRead ? 1 : 0,
        target.canPost ? 1 : 0,
        target.canManage ? 1 : 0,
        now,
        room.id,
      ],
    })),
  ]
}
export function roomStatements(db: D1Database, room: Room, now: number) {
  return roomCommands(room, now).map(({ sql, params }) =>
    db.prepare(sql).bind(...params)
  )
}

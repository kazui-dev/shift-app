import type { InferOutput } from "valibot"
import type { roomSettingsInputSchema } from "@workspace/shared/communications"
import { roomPermissions } from "./chat-permissions"
export async function saveRoomSettings(
  db: D1Database,
  roomId: string,
  actorId: string,
  input: InferOutput<typeof roomSettingsInputSchema>
) {
  const now = Date.now()
  await db.batch([
    db
      .prepare(`${roomPermissions} UPDATE chat_rooms SET name=CASE WHEN
      EXISTS(SELECT 1 FROM chat_permissions WHERE member_id=? AND can_manage=1)
      AND EXISTS(SELECT 1 FROM json_each(?) j JOIN chat_subjects s ON s.target_type=json_extract(j.value,'$.targetType') AND s.target_id=json_extract(j.value,'$.targetId')
        JOIN year_memberships ym ON ym.year=s.year AND ym.member_id=s.member_id AND ym.status='active'
        WHERE s.year=chat_rooms.year AND json_extract(j.value,'$.canManage')=1
        AND NOT EXISTS(SELECT 1 FROM chat_room_exits x WHERE x.room_id=chat_rooms.id AND x.member_id=s.member_id))
      THEN ? ELSE NULL END,allow_exit=? WHERE id=(SELECT id FROM chat_scope)`)
      .bind(
        roomId,
        actorId,
        JSON.stringify(input.targets),
        input.name,
        input.allowExit ? 1 : 0
      ),
    db
      .prepare(`DELETE FROM chat_room_exits WHERE room_id=? AND member_id IN (
      SELECT json_extract(j.value,'$.targetId') FROM json_each(?) j WHERE json_extract(j.value,'$.targetType')='member'
      AND (json_extract(j.value,'$.canRead') OR json_extract(j.value,'$.canPost') OR json_extract(j.value,'$.canManage'))
      AND NOT EXISTS(SELECT 1 FROM chat_room_targets t WHERE t.room_id=? AND t.target_type='member' AND t.target_id=json_extract(j.value,'$.targetId') AND (t.can_read OR t.can_post OR t.can_manage)))`)
      .bind(roomId, JSON.stringify(input.targets), roomId),
    db.prepare("DELETE FROM chat_room_targets WHERE room_id=?").bind(roomId),
    ...input.targets.map((target) =>
      db
        .prepare(
          "INSERT INTO chat_room_targets(room_id,target_type,target_id,can_read,can_post,can_manage,created_at) VALUES(?,?,?,?,?,?,?)"
        )
        .bind(
          roomId,
          target.targetType,
          target.targetId,
          target.canRead ? 1 : 0,
          target.canPost ? 1 : 0,
          target.canManage ? 1 : 0,
          now
        )
    ),
  ])
}

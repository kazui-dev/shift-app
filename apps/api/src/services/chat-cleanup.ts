export async function cleanDeletedRooms(env: CloudflareBindings) {
  const rooms = await env.shift_app
    .prepare(
      "SELECT room_id AS id FROM chat_room_deletions ORDER BY created_at LIMIT 20"
    )
    .all<{ id: string }>()
  await Promise.all(
    rooms.results.map(async (room) => {
      try {
        await env.CHAT_ROOMS.getByName(room.id).deleteMessages(room.id)
        await env.shift_app
          .prepare("DELETE FROM chat_room_deletions WHERE room_id=?")
          .bind(room.id)
          .run()
      } catch (error) {
        console.error(
          "Chat cleanup will retry",
          error instanceof Error ? error.message : "Unknown failure"
        )
      }
    })
  )
}

import type { getChatRooms } from "@/api/chat"
type Room = Awaited<ReturnType<typeof getChatRooms>>["rooms"][number]
export function roomSchedule(room: Room) {
  if (!room.activityStartsAt || !room.activityEndsAt) return null
  const date = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(room.activityStartsAt))
  const clock = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${date} ${clock.format(new Date(room.activityStartsAt))}–${clock.format(new Date(room.activityEndsAt))}`
}

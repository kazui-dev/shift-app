import type { getChatRooms } from "@/api/chat"
import { japanMonthDayWeekday, japanTime } from "@workspace/shared/japan-time"
type Room = Awaited<ReturnType<typeof getChatRooms>>["rooms"][number]
export function roomSchedule(room: Room) {
  if (!room.activityStartsAt || !room.activityEndsAt) return null
  return `${japanMonthDayWeekday(room.activityStartsAt)} ${japanTime(room.activityStartsAt)}〜${japanTime(room.activityEndsAt)}`
}

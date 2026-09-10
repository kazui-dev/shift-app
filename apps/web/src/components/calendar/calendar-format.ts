import { localDate } from "@/lib/calendar-dates"
import { japanTimeZone } from "@/lib/japan-time"

const weekdays = ["日", "月", "火", "水", "木", "金", "土"]

export function formatCalendarTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: japanTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatLongDate(value: string): string {
  const date = localDate(value)
  const formattedDate = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
  return `${formattedDate}（${weekdays[date.getDay()]}）`
}

import * as v from "valibot"
import { japanDateTime } from "./japan-time"

export function calendarDate(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : undefined
}
const viewSchema = v.object({
  date: v.pipe(
    v.string(),
    v.check((value) => calendarDate(value) !== undefined)
  ),
  preferredDay: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31))
  ),
  scrollTop: v.nullable(v.pipe(v.number(), v.finite(), v.minValue(0))),
})
export type SavedCalendarView = v.InferOutput<typeof viewSchema>
const memory = new Map<string, SavedCalendarView>()
export function calendarViewKey(user: string, year: number | null) {
  return `calendar-view:${user}:${year ?? "none"}`
}
export function readCalendarView(key: string): SavedCalendarView | undefined {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const parsed = v.safeParse(viewSchema, JSON.parse(raw))
      if (parsed.success) return parsed.output
      sessionStorage.removeItem(key)
    }
  } catch {
    /* Memory remains usable when browser storage is unavailable. */
  }
  return memory.get(key)
}
export function saveCalendarView(key: string, view: SavedCalendarView) {
  memory.set(key, view)
  try {
    sessionStorage.setItem(key, JSON.stringify(view))
  } catch {
    /* Optional persistence. */
  }
}
export function resolveCalendarView(
  key: string,
  explicit: unknown,
  now = new Date()
) {
  const saved = readCalendarView(key)
  const date = calendarDate(explicit) ?? saved?.date ?? japanDateTime(now).date
  return {
    date,
    scrollTop: saved?.date === date ? saved.scrollTop : null,
    preferredDay:
      saved?.date === date
        ? (saved.preferredDay ?? Number(date.slice(8)))
        : Number(date.slice(8)),
  }
}

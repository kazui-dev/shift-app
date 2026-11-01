import { matchesFilter, type FilterValue } from "@workspace/ui/lib/filters"
import { japanDateTime } from "@workspace/shared/japan-time"
import type { ShiftOverview } from "@workspace/shared/shifts"
export type OverviewFilters = {
  date: string
  roles: FilterValue
  activities: FilterValue
  search: string
}
export type OverviewSelection = {
  memberId: string
  activityId: string
  slotId: string | null
  startsAt: string
  endsAt: string
}
export function overviewRows(data: ShiftOverview, filters: OverviewFilters) {
  const term = filters.search.trim().toLocaleLowerCase()
  return data.members
    .filter(
      (m) =>
        matchesFilter(
          m.roles.map((r) => r.id),
          filters.roles
        ) &&
        `${m.displayName} ${m.studentId}`.toLocaleLowerCase().includes(term) &&
        matchesFilter(
          data.assignments
            .filter((a) => a.memberId === m.id)
            .map((a) => a.activityId),
          filters.activities
        )
    )
    .map((member) => ({
      member,
      assignments: data.assignments.filter((a) => a.memberId === member.id),
    }))
}
export function overviewRange(data: ShiftOverview, date: string) {
  const day = Date.parse(`${date}T00:00:00+09:00`),
    next = day + 86_400_000
  const windows = [...data.assignments, ...data.availability]
  const start = Math.max(
    day,
    Math.floor(
      Math.min(
        day + 8 * 3_600_000,
        ...windows.map((w) => Date.parse(w.startsAt))
      ) / 3_600_000
    ) * 3_600_000
  )
  const end = Math.min(
    next,
    Math.ceil(
      Math.max(
        day + 20 * 3_600_000,
        ...windows.map((w) => Date.parse(w.endsAt))
      ) / 3_600_000
    ) * 3_600_000
  )
  return { start, end }
}

export function overviewInitialDate(
  activities: readonly { startsAt: string; endsAt: string; active: boolean }[],
  today: string
) {
  const start = Date.parse(`${today}T00:00:00+09:00`)
  const active = activities.filter((activity) => activity.active)
  if (
    active.some(
      (activity) =>
        Date.parse(activity.startsAt) < start + 86_400_000 &&
        Date.parse(activity.endsAt) > start
    )
  )
    return today
  const first = active
    .map((activity) => activity.startsAt)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0]
  return first ? japanDateTime(first).date : today
}

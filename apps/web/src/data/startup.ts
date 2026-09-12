import { chatRoomId } from "@/lib/chat-location"
import type { QueryClient } from "@tanstack/react-query"
import { usersQuery, auditQuery, linksQuery } from "./admin"
import { assignmentMonthQuery } from "@/api/assignments"
import { calendarViewKey, resolveCalendarView } from "@/lib/calendar-view"
import { displayYearQuery, yearsQuery, rolesQuery, rosterQuery } from "./years"
import { roomsQuery, targetsQuery, prepareConversation } from "./chat"
import { activitiesQuery, activityQuery } from "./activities"
import {
  availabilityQuery,
  availabilityDatesQuery,
  availabilitySubmissionsQuery,
} from "./availability"

export async function prepareApp(
  client: QueryClient,
  pathname: string,
  studentId: string,
  admin: boolean,
  explicitDate?: unknown
) {
  const [display, available] = await Promise.all([
    client.ensureQueryData({ ...displayYearQuery, revalidateIfStale: true }),
    client.ensureQueryData({ ...yearsQuery, revalidateIfStale: true }),
  ])
  const year = display.year
  const month = resolveCalendarView(
    calendarViewKey(studentId, year),
    pathname === "/calendar" ? explicitDate : undefined
  ).date.slice(0, 7)
  const work: Promise<unknown>[] = []
  const wait = (key: readonly unknown[], request: Promise<unknown>) => {
    if (client.getQueryData(key) === undefined) work.push(request)
  }
  if (year !== null) {
    const calendar = client.prefetchQuery(assignmentMonthQuery(month, year))
    const rooms = client.prefetchQuery(roomsQuery(year))
    const availability = client.prefetchQuery(availabilityQuery(year))
    void client.prefetchQuery(targetsQuery(year))
    if (pathname === "/calendar")
      wait(assignmentMonthQuery(month, year).queryKey, calendar)
    if (pathname.startsWith("/chat")) wait(roomsQuery(year).queryKey, rooms)
    if (pathname === "/availability")
      wait(availabilityQuery(year).queryKey, availability)
  }
  const manageable = available.years.filter((item) => item.canManage)
  let saved: number | null = null
  try {
    const value = localStorage.getItem(`management-year:${studentId}`)
    if (value) saved = Number(value)
  } catch {
    /* Storage is optional. */
  }
  const managementYear =
    manageable.find((item) => item.year === saved)?.year ??
    manageable.find((item) => item.isDefault)?.year ??
    manageable[0]?.year
  if (managementYear !== undefined) {
    const activities = client.prefetchQuery(activitiesQuery(managementYear))
    const roles = client.prefetchQuery(rolesQuery(managementYear))
    const roster = client.prefetchQuery(rosterQuery(managementYear))
    if (pathname === "/manage/shifts")
      wait(activitiesQuery(managementYear).queryKey, activities)
    if (pathname === "/manage/roles" || pathname === "/manage/members") {
      wait(rolesQuery(managementYear).queryKey, roles)
      wait(rosterQuery(managementYear).queryKey, roster)
    }
    if (pathname === "/manage/availability") {
      wait(
        availabilityDatesQuery(managementYear).queryKey,
        client.prefetchQuery(availabilityDatesQuery(managementYear))
      )
      wait(
        availabilitySubmissionsQuery(managementYear).queryKey,
        client.prefetchQuery(availabilitySubmissionsQuery(managementYear))
      )
    }
  }
  if (admin) {
    if (pathname === "/manage/users")
      wait(usersQuery.queryKey, client.prefetchQuery(usersQuery))
    if (pathname === "/manage/audit")
      wait(auditQuery.queryKey, client.prefetchQuery(auditQuery))
    if (pathname === "/manage/discord-link-requests")
      wait(linksQuery.queryKey, client.prefetchQuery(linksQuery))
  }
  const activity = /^\/manage\/shifts\/([^/]+)$/.exec(pathname)?.[1]
  if (activity)
    wait(
      activityQuery(activity).queryKey,
      client.prefetchQuery(activityQuery(activity))
    )
  const room = chatRoomId(pathname)
  if (room) void prepareConversation(client, room)
  await Promise.all(work)
}

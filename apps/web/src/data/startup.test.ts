import { afterEach, expect, it, vi } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { prepareApp } from "./startup"
import { calendarViewKey, saveCalendarView } from "@/lib/calendar-view"
import { apiJson, apiVoid } from "@/api/client"

vi.mock("@/api/client", () => ({
  apiJson: vi.fn<typeof apiJson>(),
  apiVoid: vi.fn<typeof apiVoid>(),
}))
afterEach(() => vi.restoreAllMocks())
it("prepares primary destinations without fetching all conversations or privileged management data", async () => {
  const requests: string[] = []
  vi.mocked(apiJson).mockImplementation(async (path) => {
    requests.push(path)
    if (path === "/api/me/display-year")
      return {
        year: 2026,
        defaultYear: 2026,
        years: [2026],
        unavailableSelection: false,
      }
    if (path === "/api/years")
      return { years: [{ year: 2026, canManage: false }] }
    return {}
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await prepareApp(client, "/calendar", "test", false)
  expect(requests).toContain("/api/me/display-year")
  expect(requests.some((path) => path.startsWith("/api/me/assignments?"))).toBe(
    true
  )
  expect(requests).toContain("/api/me/availability/2026")
  expect(requests).toContain("/api/chat/rooms?year=2026")
  expect(requests.some((path) => /messages|roster|\/admin\//.test(path))).toBe(
    false
  )
  client.clear()
})
it("does not hold a warm calendar transition behind background revalidation", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(
    ["display-year"],
    { year: null, defaultYear: 2026, years: [], unavailableSelection: false },
    { updatedAt: 1 }
  )
  client.setQueryData(["years"], { years: [] }, { updatedAt: 1 })
  vi.mocked(apiJson).mockImplementation(() => new Promise(() => {}))
  await prepareApp(client, "/settings", "test", false)
  expect(client.isFetching()).toBe(2)
  await client.cancelQueries()
  client.clear()
})

it.each([
  ["2026-11-04", "2026-10-31T15:00:00.000Z"],
  [undefined, "2026-09-30T15:00:00.000Z"],
])("prefetches the resolved calendar month for %s", async (date, from) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(["display-year"], {
    year: 2026,
    defaultYear: 2026,
    years: [2026],
    unavailableSelection: false,
  })
  client.setQueryData(["years"], { years: [] })
  saveCalendarView(calendarViewKey("startup-month", 2026), {
    date: "2026-10-03",
    scrollTop: null,
  })
  const requests: string[] = []
  vi.mocked(apiJson).mockImplementation(async (path) => {
    requests.push(path)
    return {}
  })
  await prepareApp(client, "/calendar", "startup-month", false, date)
  const assignments = requests.filter((path) =>
    path.startsWith("/api/me/assignments?")
  )
  expect(assignments).toHaveLength(1)
  expect(
    new URL(assignments[0] ?? "", "https://example.test").searchParams.get(
      "from"
    )
  ).toBe(from)
  client.clear()
})

it("loads form settings under shifts without treating availability as an activity ID", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(["display-year"], {
    year: null,
    defaultYear: 2026,
    years: [],
    unavailableSelection: false,
  })
  client.setQueryData(["years"], { years: [{ year: 2026, canManage: true }] })
  const requests: string[] = []
  vi.mocked(apiJson).mockImplementation(async (path) => {
    requests.push(path)
    return {}
  })
  await prepareApp(client, "/manage/shifts/availability", "test", true)
  expect(requests).toContain("/api/years/2026/availability-dates")
  expect(requests).toContain("/api/years/2026/availability-submissions")
  expect(requests).not.toContain("/api/activities/availability")
  client.clear()
})

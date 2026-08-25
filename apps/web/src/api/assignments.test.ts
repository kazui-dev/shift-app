import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import {
  assignmentMonthQuery,
  assignmentMonthRange,
  assignmentsByDate,
  type CalendarAssignment,
} from "./assignments"

afterEach(() => vi.unstubAllGlobals())

function assignment(
  id: string,
  startsAt: string,
  endsAt: string
): CalendarAssignment {
  return {
    id,
    activityId: "00000000-0000-4000-8000-000000000010",
    memberId: "00000000-0000-4000-8000-000000000020",
    memberDisplayName: "テスト利用者",
    startsAt,
    endsAt,
    notes: null,
    checkedInAt: null,
    activityName: "受付",
    place: "正門",
    activityType: "shift",
    color: "#2563eb",
  }
}

describe("assignment month queries", () => {
  it("uses one stable query key and one calendar-month range", () => {
    const query = assignmentMonthQuery("2026-08")
    const range = assignmentMonthRange("2026-08")

    expect(query.queryKey).toEqual(["assignments", "month", "2026-08"])
    expect(new Date(range.from).getDate()).toBe(1)
    expect(new Date(range.from).getHours()).toBe(0)
    expect(new Date(range.to).getMonth()).toBe(
      (new Date(range.from).getMonth() + 1) % 12
    )
    expect(new Date(range.to).getDate()).toBe(1)
    expect(new Date(range.to).getHours()).toBe(0)
  })

  it("reuses a fresh cached month without another request", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ assignments: [] })
    )
    vi.stubGlobal("fetch", fetchMock)
    const client = new QueryClient()
    const query = assignmentMonthQuery("2026-08")

    await client.prefetchQuery(query)
    await client.prefetchQuery(query)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("assignment day classification", () => {
  it("classifies cross-boundary assignments and removes month duplicates", () => {
    const overnight = assignment(
      "00000000-0000-4000-8000-000000000001",
      "2026-08-31T23:00:00+09:00",
      "2026-09-01T01:00:00+09:00"
    )
    const daytime = assignment(
      "00000000-0000-4000-8000-000000000002",
      "2026-09-01T09:00:00+09:00",
      "2026-09-01T12:00:00+09:00"
    )

    const result = assignmentsByDate(
      ["2026-08-31", "2026-09-01"],
      [{ assignments: [overnight] }, { assignments: [overnight, daytime] }]
    )

    expect(result.get("2026-08-31")?.map(({ id }) => id)).toEqual([
      overnight.id,
    ])
    expect(result.get("2026-09-01")?.map(({ id }) => id)).toEqual([
      overnight.id,
      daytime.id,
    ])
  })
})

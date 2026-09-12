import { afterEach, expect, it, vi } from "vite-plus/test"
import { getAvailabilitySubmissions } from "./availability"

afterEach(() => vi.unstubAllGlobals())

it("loads manager submissions containing a full day through 24:00", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({
        progress: [
          {
            memberId: "10000000-0000-4000-8000-000000000001",
            displayName: "テスト",
            studentId: "26AJ001",
            complete: true,
          },
        ],
        submissions: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            member: {
              id: "10000000-0000-4000-8000-000000000001",
              displayName: "テスト",
              studentId: "26AJ001",
            },
            status: "submitted",
            submittedAt: "2026-09-13T00:00:00.000Z",
            windows: [
              {
                id: "30000000-0000-4000-8000-000000000001",
                date: "2026-10-29",
                startsAt: "2026-10-28T15:00:00.000Z",
                endsAt: "2026-10-29T15:00:00.000Z",
              },
            ],
          },
        ],
      })
    )
  )
  await expect(getAvailabilitySubmissions(2026)).resolves.toMatchObject({
    submissions: [
      { windows: [{ date: "2026-10-29", endsAt: "2026-10-29T15:00:00.000Z" }] },
    ],
  })
})

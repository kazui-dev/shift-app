import { afterEach, expect, it, vi } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { prepareApp } from "./startup"
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
  expect(requests).toContain("/api/chat/rooms?year=2026&closed=false")
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

import { afterEach, expect, it, vi } from "vite-plus/test"
import { restoreChatView, saveChatView } from "@/features/chat/lib/view"

afterEach(() => vi.unstubAllGlobals())

it("restores the last accessible room independent of posting order and isolates members and years", () => {
  const storage = new Map<string, string>()
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  const rooms = [{ id: "latest" }, { id: "last-viewed" }]
  saveChatView("one", 2026, "last-viewed")
  expect(restoreChatView("one", 2026, rooms)).toBe("last-viewed")
  expect(restoreChatView("two", 2026, rooms)).toBe("latest")
  expect(restoreChatView("one", 2027, rooms)).toBe("latest")
  expect(restoreChatView("one", 2026, [{ id: "latest" }])).toBe("latest")
  expect(restoreChatView("one", 2026, [])).toBeUndefined()
  storage.set("chat-view:restored:2026", "last-viewed")
  expect(restoreChatView("restored", 2026, rooms)).toBe("last-viewed")
})

it("keeps navigation usable when browser storage throws", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
  })
  saveChatView("blocked", 2026, "second")
  expect(
    restoreChatView("blocked", 2026, [{ id: "first" }, { id: "second" }])
  ).toBe("second")
})

import { readFileSync } from "node:fs"
import { URL } from "node:url"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vite-plus/test"

const source = readFileSync(
  new URL("../../web/public/push-sw.js", import.meta.url),
  "utf8"
)
type Click = {
  notification: { data: { url: string }; close: () => void }
  waitUntil: (work: Promise<unknown>) => void
}
it("waits for notification navigation before focusing the existing app", async () => {
  const handlers = new Map<string, (event: Click) => void>()
  const focus = vi.fn<() => Promise<void>>(async () => undefined)
  let finish: () => void = () => undefined
  const navigate = vi.fn<() => Promise<{ focus: typeof focus }>>(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ focus })
      })
  )
  const openWindow = vi.fn<() => Promise<void>>(async () => undefined)
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: "https://shift.example" },
      addEventListener: (type: string, handler: (event: Click) => void) =>
        handlers.set(type, handler),
      clients: {
        matchAll: async () => [
          { url: "https://shift.example/calendar", navigate, focus },
        ],
        openWindow,
      },
    },
  })
  let work: Promise<unknown> = Promise.resolve()
  handlers.get("notificationclick")?.({
    notification: { data: { url: "/chat/one" }, close: () => undefined },
    waitUntil: (promise) => {
      work = promise
    },
  })
  await vi.waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("https://shift.example/chat/one")
  )
  expect(focus).not.toHaveBeenCalled()
  finish()
  await work
  expect(focus).toHaveBeenCalledOnce()
  expect(openWindow).not.toHaveBeenCalled()
})
it("does not navigate to an external origin from notification data", () => {
  const handlers = new Map<string, (event: Click) => void>()
  const waitUntil = vi.fn<(work: Promise<unknown>) => void>()
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: "https://shift.example" },
      addEventListener: (type: string, handler: (event: Click) => void) =>
        handlers.set(type, handler),
    },
  })
  handlers.get("notificationclick")?.({
    notification: {
      data: { url: "https://other.example/" },
      close: () => undefined,
    },
    waitUntil,
  })
  expect(waitUntil).not.toHaveBeenCalled()
})

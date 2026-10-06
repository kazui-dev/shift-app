import { readFileSync } from "node:fs"
import { URL } from "node:url"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vite-plus/test"

const source = readFileSync(
  new URL("../../../web/public/push-sw.js", import.meta.url),
  "utf8"
)
type Click = {
  notification: { data: { url: string }; close: () => void }
  waitUntil: (work: Promise<unknown>) => void
}
it("routes an existing app without reloading its document", async () => {
  const handlers = new Map<string, (event: Click) => void>()
  const focus = vi.fn<() => Promise<void>>(async () => undefined)
  const navigate = vi.fn<() => void>()
  const openWindow = vi.fn<() => void>()
  const postMessage = vi.fn<(_data: unknown, ports: MessagePort[]) => void>(
    (_data, ports) => ports[0]?.postMessage({ ok: true })
  )
  runInNewContext(source, {
    URL,
    MessageChannel,
    setTimeout,
    clearTimeout,
    self: {
      location: { origin: "https://shift.example" },
      addEventListener: (type: string, handler: (event: Click) => void) =>
        handlers.set(type, handler),
      clients: {
        matchAll: async () => [
          {
            url: "https://shift.example/calendar",
            navigate,
            focus,
            postMessage,
          },
        ],
        openWindow,
      },
    },
  })
  let work: Promise<unknown> = Promise.resolve()
  handlers.get("notificationclick")?.({
    notification: { data: { url: "/chat/one" }, close: () => undefined },
    waitUntil: (p) => {
      work = p
    },
  })
  await work
  expect(postMessage).toHaveBeenCalledWith(
    { type: "NOTIFICATION_NAVIGATE", url: "https://shift.example/chat/one" },
    expect.anything()
  )
  expect(focus).toHaveBeenCalledOnce()
  expect(navigate).not.toHaveBeenCalled()
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

it.each(["missing", "invalid", "valid"])(
  "shows a visible notification for %s push payloads",
  async (kind) => {
    type Push = {
      data?: { json: () => unknown }
      waitUntil: (work: Promise<unknown>) => void
    }
    const handlers = new Map<string, (event: Push) => void>()
    const showNotification = vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined)
    runInNewContext(source, {
      self: {
        addEventListener: (type: string, handler: (event: Push) => void) =>
          handlers.set(type, handler),
        registration: { showNotification },
      },
    })
    let work: Promise<unknown> = Promise.resolve()
    handlers.get("push")?.({
      ...(kind === "missing"
        ? {}
        : {
            data: {
              json: () => {
                if (kind === "invalid") throw new SyntaxError("invalid")
                return {
                  title: "New message",
                  body: "Hello",
                  icon: "/avatar.webp",
                }
              },
            },
          }),
      waitUntil: (promise) => {
        work = promise
      },
    })
    await work
    expect(showNotification).toHaveBeenCalledWith(
      kind === "valid" ? "New message" : "旭祭シフト",
      expect.objectContaining({
        icon: kind === "valid" ? "/avatar.webp" : "/icon-192.png",
      })
    )
  }
)

it("closes read notifications while preserving newer and legacy payloads", async () => {
  type Read = { data: unknown; waitUntil: (work: Promise<unknown>) => void }
  const handlers = new Map<string, (event: Read) => void>()
  const notifications = [
    { data: { roomId: "room", sequence: 5 }, close: vi.fn<() => void>() },
    { data: { roomId: "room", sequence: 7 }, close: vi.fn<() => void>() },
    { data: { roomId: "other", sequence: 1 }, close: vi.fn<() => void>() },
    { data: { url: "/chat/room" }, close: vi.fn<() => void>() },
  ]
  runInNewContext(source, {
    self: {
      addEventListener: (type: string, handler: (event: Read) => void) =>
        handlers.set(type, handler),
      registration: { getNotifications: async () => notifications },
    },
  })
  let work: Promise<unknown> = Promise.resolve()
  handlers.get("message")?.({
    data: { type: "CHAT_READ", roomId: "room", sequence: 5 },
    waitUntil: (p) => {
      work = p
    },
  })
  await work
  expect(notifications.map((n) => n.close.mock.calls.length)).toEqual([
    1, 0, 0, 0,
  ])
})

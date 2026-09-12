import { expect, it, vi } from "vite-plus/test"
import { ChatDirectory } from "../src/durable-objects/chat-directory"
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown
    ) {}
  },
}))
it("notifies every connected device of participants and no other member", () => {
  const socket = (id: string) => ({
    deserializeAttachment: () => id,
    send: vi.fn<(message: string) => void>(),
    close: vi.fn<(code: number, reason: string) => void>(),
  })
  const one = socket("participant"),
    two = socket("participant"),
    other = socket("outside")
  const result: unknown = Reflect.construct(ChatDirectory, [
    { getWebSockets: () => [one, two, other] },
    {},
  ])
  if (!(result instanceof ChatDirectory)) throw Error("Invalid directory")
  result.publish(["participant"])
  expect(one.send).toHaveBeenCalledWith('{"type":"rooms_changed"}')
  expect(two.send).toHaveBeenCalledWith('{"type":"rooms_changed"}')
  expect(other.send).not.toHaveBeenCalled()
})

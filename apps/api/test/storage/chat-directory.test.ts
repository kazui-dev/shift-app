import { expect, it, vi } from "vite-plus/test"
import { ChatDirectory } from "../../src/durable-objects/chat-directory"
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
  result.publish(["participant"], { type: "room_changed", roomId: "room" })
  expect(one.send).toHaveBeenCalledWith(
    '{"type":"room_changed","roomId":"room"}'
  )
  expect(two.send).toHaveBeenCalledWith(
    '{"type":"room_changed","roomId":"room"}'
  )
  expect(other.send).not.toHaveBeenCalled()
  result.accessChanged()
  expect(other.send).toHaveBeenCalledWith('{"type":"access_changed"}')
  expect(one.send).toHaveBeenLastCalledWith('{"type":"access_changed"}')
})

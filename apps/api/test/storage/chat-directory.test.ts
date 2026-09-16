import { expect, it, vi } from "vite-plus/test"
import { ChatDirectory } from "../../src/durable-objects/chat-directory"
it("delivers chat events to participants only and changes to every device", () => {
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
  result.broadcast({ type: "shifts_changed" })
  expect(other.send).toHaveBeenCalledWith('{"type":"shifts_changed"}')
  expect(one.send).toHaveBeenLastCalledWith('{"type":"shifts_changed"}')
})

import { expect, it } from "vite-plus/test"
import { chatRoomId } from "./chat-location"
it("only prepares conversations, never the create page or list", () => {
  expect(chatRoomId("/chat/new")).toBeUndefined()
  expect(chatRoomId("/chat")).toBeUndefined()
  expect(chatRoomId("/chat/one")).toBe("one")
  expect(chatRoomId("/chat/one/settings")).toBeUndefined()
  expect(chatRoomId("/chat/one/info/settings")).toBe("one")
  expect(chatRoomId("/chat/one/info")).toBe("one")
  expect(chatRoomId("/chat/new/info")).toBeUndefined()
  expect(chatRoomId("/chat/new/settings")).toBeUndefined()
  expect(chatRoomId("/chat/one/unknown")).toBeUndefined()
})

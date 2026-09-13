import { expect, it } from "vite-plus/test"
import { chatRoomId } from "@/lib/chat/location"
it("resolves every conversation surface, never the create page or list", () => {
  expect(chatRoomId("/chat/new")).toBeUndefined()
  expect(chatRoomId("/chat")).toBeUndefined()
  expect(chatRoomId("/chat/one")).toBe("one")
  expect(chatRoomId("/chat/one/settings")).toBe("one")
  expect(chatRoomId("/chat/one/info/settings")).toBe("one")
  expect(chatRoomId("/chat/one/info")).toBe("one")
  expect(chatRoomId("/chat/one/search")).toBe("one")
  expect(chatRoomId("/chat/new/search")).toBeUndefined()
  expect(chatRoomId("/chat/new/info")).toBeUndefined()
  expect(chatRoomId("/chat/new/settings")).toBeUndefined()
  expect(chatRoomId("/chat/one/info/anything")).toBe("one")
})

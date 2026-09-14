import { describe, expect, it } from "vite-plus/test"
import {
  attachmentFileName,
  attachmentName,
  chatImageKey,
  chatImageTag,
  chatRoomTag,
  dailyUploadLimit,
} from "../../src/domain/chat-attachment"

it("names storage and cache tags by room and attachment", () => {
  expect(chatImageKey("room", "image")).toBe("room/image")
  expect(chatImageTag("image")).toBe("chat-image:image")
  expect(chatRoomTag("room")).toBe("chat-room:room")
})

describe("attachment names", () => {
  const control = String.fromCharCode(0x01, 0x7f)
  it.each([
    ["IMG_0001.HEIC", "image/jpeg", "IMG_0001.jpg"],
    ["photo.JPEG", "image/jpeg", "photo.JPEG"],
    ["photo.jpg", "image/png", "photo.png"],
    ["my.photo", "image/png", "my.photo.png"],
    [` a/b\\c:d*e?f"g<h>i|j${control}.gif `, "image/gif", "abcdefghij.gif"],
    [".png", "image/png", ""],
    [`  ${String.fromCharCode(0)} `, "image/webp", ""],
  ] as const)("saves %j as %j", (value, type, name) => {
    expect(attachmentName(value, type)).toBe(name)
  })
  it("shortens a long name to 255 bytes without splitting a character", () => {
    const name = attachmentName(`${"あ".repeat(100)}.png`, "image/png")
    expect(name).toBe(`${"あ".repeat(83)}.png`)
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255)
  })
  it("falls back to when the message was sent, in Japan time", () => {
    const sentAt = Date.parse("2026-09-13T05:32:05Z")
    expect(attachmentFileName("", "image/png", sentAt)).toBe(
      "20260913-143205.png"
    )
    expect(attachmentFileName("photo.png", "image/png", sentAt)).toBe(
      "photo.png"
    )
  })
})

it("gives each member the daily upload limit of their highest role", () => {
  const gigabyte = 1024 * 1024 * 1024
  const member = { count: 100, bytes: gigabyte }
  const manager = { count: 300, bytes: 3 * gigabyte }
  const admin = { count: 1000, bytes: 5 * gigabyte }
  expect(dailyUploadLimit("member", false)).toEqual(member)
  expect(dailyUploadLimit("member", true)).toEqual(manager)
  expect(dailyUploadLimit("leader", false)).toEqual(manager)
  expect(dailyUploadLimit("system_admin", false)).toEqual(admin)
  expect(dailyUploadLimit("system_admin", true)).toEqual(admin)
})

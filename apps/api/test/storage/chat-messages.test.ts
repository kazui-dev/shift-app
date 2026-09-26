import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { ChatRoom } from "../../src/features/chat/durable-objects/chat-room"
import { findAccessibleRoom } from "../../src/features/chat/services/chat-access"
import { roomRecipients } from "../../src/features/chat/services/chat-permissions"
import { purgeShared } from "../../src/lib/shared-cache"
import { publishChatEvent } from "../../src/features/chat/services/chat-directory"
import { makeLinkCard } from "../../src/features/chat/services/link-card"
import { chatRoom } from "../support/chat"
vi.mock("../../src/lib/shared-cache", () => ({
  purgeShared: vi.fn<typeof purgeShared>().mockResolvedValue(undefined),
}))
vi.mock("../../src/features/chat/services/link-card", () => ({
  makeLinkCard: vi.fn<typeof makeLinkCard>(),
}))
vi.mock("../../src/features/chat/services/chat-directory", () => ({
  publishChatEvent: vi.fn<typeof publishChatEvent>(),
}))
vi.mock("../../src/features/chat/services/chat-profiles", () => ({
  withMemberImages: async (_env: unknown, messages: unknown) => messages,
}))
vi.mock("../../src/features/chat/services/chat-access", () => ({
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
vi.mock("../../src/features/chat/services/chat-permissions", () => ({
  roomRecipients: vi.fn<typeof roomRecipients>(),
}))
const room = chatRoom({ id: "room", name: "room", createdBy: "author" })
const databases: DatabaseSync[] = []
beforeEach(() => {
  vi.mocked(findAccessibleRoom).mockResolvedValue(room)
  vi.mocked(roomRecipients).mockResolvedValue([])
})
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
  vi.clearAllMocks()
})
function fixture() {
  const db = new DatabaseSync(":memory:")
  databases.push(db)
  db.exec("PRAGMA foreign_keys=ON")
  const bucket = {
    delete: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
  const storage = {
    sql: {
      exec: (sql: string, ...params: SQLInputValue[]) => {
        let rows: Record<string, unknown>[] = []
        if (sql.trim().endsWith(";")) db.exec(sql)
        else rows = db.prepare(sql).all(...params)
        return {
          toArray: () => rows,
          one: () => {
            if (!rows[0]) throw Error("Missing SQL row")
            return rows[0]
          },
        }
      },
    },
    transactionSync: (callback: () => unknown) => {
      db.exec("BEGIN")
      try {
        const value = callback()
        db.exec("COMMIT")
        return value
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
    },
    getAlarm: () => Promise.resolve(null),
    setAlarm: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
  const value: unknown = Reflect.construct(ChatRoom, [
    {
      storage,
      blockConcurrencyWhile: (callback: () => Promise<void>) => callback(),
      getWebSockets: () => [],
    },
    {
      CHAT_IMAGES: bucket,
      // Every room here is already deleted from D1.
      shift_app: {
        prepare: () => ({
          bind: () => ({ first: () => Promise.resolve(null) }),
        }),
      },
    },
  ])
  if (!(value instanceof ChatRoom)) throw Error("Invalid room")
  return { value, db, bucket, storage }
}
/** The author, who looks after no shift. */
const author = { memberId: "author", readsPrivate: false }
const input = (id: string) => ({
  roomId: "room",
  id,
  ...author,
  memberDisplayName: "Author",
  content: "original",
  createdAt: 100,
  attachmentIds: [],
})
const card = (path: string) => ({
  url: `https://example.com/${path}`,
  title: path,
  description: "",
  site: "example.com",
  image: `https://example.com/${path}.png`,
})
const editFirst = (content?: string) => ({
  roomId: "room",
  ...author,
  id: "first",
  ...(content === undefined ? {} : { content }),
})
it("sends without waiting on the link, then stores its card and tells the room", async () => {
  const { value, storage } = fixture()
  vi.mocked(makeLinkCard).mockResolvedValue(card("a"))
  const sent = await value.sendMessage({
    ...input("first"),
    content: "see https://example.com/a and https://example.com/b",
  })
  expect(sent.linkPreview).toBeNull()
  expect(makeLinkCard).not.toHaveBeenCalled()
  expect(storage.setAlarm).toHaveBeenCalled()
  await value.alarm()
  expect(makeLinkCard).toHaveBeenCalledWith("https://example.com/a")
  expect(value.getMessages(null, 100, author).messages[0]?.linkPreview).toEqual(
    card("a")
  )
  expect(publishChatEvent).toHaveBeenCalledWith(expect.anything(), {
    type: "message_changed",
    roomId: "room",
    message: expect.objectContaining({ id: "first", linkPreview: card("a") }),
  })
})
it("tries a failed card twice more, later each time, then leaves the message without one", async () => {
  vi.useFakeTimers({ now: 1_000_000 })
  try {
    const { value, storage } = fixture()
    vi.mocked(makeLinkCard).mockResolvedValue(null)
    await value.sendMessage({
      ...input("first"),
      content: "https://example.com/a",
    })
    await value.alarm()
    expect(storage.setAlarm).toHaveBeenLastCalledWith(1_000_000 + 360_000)
    vi.setSystemTime(1_360_000)
    await value.alarm()
    expect(storage.setAlarm).toHaveBeenLastCalledWith(1_360_000 + 1_800_000)
    const scheduled = storage.setAlarm.mock.calls.length
    vi.setSystemTime(3_160_000)
    await value.alarm()
    expect(makeLinkCard).toHaveBeenCalledTimes(3)
    expect(storage.setAlarm).toHaveBeenCalledTimes(scheduled)
    expect(value.linkPreview("first", author)).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})
it("never stores a card for a link the message no longer has", async () => {
  const { value } = fixture()
  let finish: (made: ReturnType<typeof card>) => void = () => {}
  vi.mocked(makeLinkCard)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    .mockResolvedValue(card("b"))
  await value.sendMessage({
    ...input("first"),
    content: "https://example.com/a",
  })
  const running = value.alarm()
  await vi.waitFor(() => expect(makeLinkCard).toHaveBeenCalledOnce())
  await value.changeMessage(editFirst("https://example.com/b"))
  finish(card("a"))
  await running
  expect(value.linkPreview("first", author)).toBeNull()
  await value.alarm()
  expect(value.linkPreview("first", author)).toEqual(card("b"))
})
it("keeps a card while the first link stays, and drops it when the link changes or the message goes", async () => {
  const { value, db } = fixture()
  vi.mocked(makeLinkCard).mockResolvedValue(card("a"))
  await value.sendMessage({
    ...input("first"),
    content: "https://example.com/a",
  })
  await value.alarm()
  await value.changeMessage(editFirst("https://example.com/a again"))
  expect(value.linkPreview("first", author)).toEqual(card("a"))
  expect(makeLinkCard).toHaveBeenCalledOnce()
  await value.changeMessage(editFirst("no link now"))
  expect(value.linkPreview("first", author)).toBeNull()
  await value.changeMessage(editFirst("https://example.com/a"))
  await value.alarm()
  expect(value.linkPreview("first", author)).toEqual(card("a"))
  // A stored card that no longer reads as one shows none.
  db.exec("UPDATE messages SET link_preview='{}' WHERE id='first'")
  expect(value.linkPreview("first", author)).toBeNull()
  await value.changeMessage(editFirst())
  expect(value.linkPreview("first", author)).toBeNull()
  expect(value.linkPreview("missing", author)).toBeNull()
})
it("persists replies and edits and removes deleted reply text without changing sequence numbers", async () => {
  const { value } = fixture()
  const first = await value.sendMessage(input("first"))
  const reply = await value.sendMessage({
    ...input("second"),
    createdAt: 200,
    replyToId: "first",
  })
  expect(reply.reply).toMatchObject({ id: "first", content: "original" })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      readsPrivate: false,
      id: "first",
      content: "edited",
    })
  ).toMatchObject({
    message: {
      content: "edited",
      sequence: first.sequence,
      editedAt: expect.any(String),
    },
  })
  expect(value.getMessages(null, 100, author).messages[1]?.reply?.content).toBe(
    "edited"
  )
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      readsPrivate: false,
      id: "first",
    })
  ).toMatchObject({ message: { deleted: true, content: "", attachments: [] } })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      readsPrivate: false,
      id: "first",
    })
  ).toMatchObject({ message: { deleted: true, content: "" } })
  const messages = value.getMessages(null, 100, author).messages
  expect(messages.map((m) => m.sequence)).toEqual([1, 2])
  expect(messages[1]?.reply).toMatchObject({ deleted: true, content: "" })
  await expect(
    value.sendMessage({ ...input("third"), replyToId: "first" })
  ).rejects.toThrow("INVALID_CHAT_REPLY")
  await expect(
    value.sendMessage({ ...input("fourth"), replyToId: "another-room-message" })
  ).rejects.toThrow("INVALID_CHAT_REPLY")
})
it("enforces authorship, manager deletion, revoked access inside the room", async () => {
  const { value } = fixture()
  await value.sendMessage(input("first"))
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      readsPrivate: false,
      id: "first",
      content: "bad",
    })
  ).toEqual({ error: "forbidden" })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      readsPrivate: false,
      id: "first",
    })
  ).toEqual({ error: "forbidden" })
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, canManage: 1 })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      readsPrivate: false,
      id: "first",
      content: "bad",
    })
  ).toEqual({ error: "forbidden" })
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      readsPrivate: false,
      id: "first",
    })
  ).toEqual({ error: "not_found" })
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, canManage: 1 })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      readsPrivate: false,
      id: "first",
    })
  ).toMatchObject({ message: { deleted: true } })
})
it("names sent images, denies reads after deletion and removes their objects and cached sizes", async () => {
  const { value, bucket } = fixture()
  const reserved = await value.reserveAttachment(
    "room",
    "author",
    50,
    dailyUploads,
    false
  )
  if (!reserved) throw Error("No reservation")
  expect(reserved.objectKey).toBe(`room/${reserved.id}`)
  value.finishAttachment(reserved.id, "author", {
    width: 10,
    height: 10,
    bytes: 50,
    name: "",
    type: "image/png",
  })
  const sent = await value.sendMessage({
    ...input("first"),
    attachmentIds: [reserved.id],
  })
  const name = "19700101-090000.png"
  expect(sent.attachments).toEqual([
    { id: reserved.id, width: 10, height: 10, bytes: 50, name, original: true },
  ])
  expect(value.getAttachment(reserved.id, author)).toEqual({
    name,
    type: "image/png",
  })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      readsPrivate: false,
      id: "first",
      content: "",
    })
  ).toMatchObject({ message: { content: "" } })
  await value.changeMessage({
    roomId: "room",
    memberId: "author",
    readsPrivate: false,
    id: "first",
  })
  expect(value.getAttachment(reserved.id, author)).toBeNull()
  await value.alarm()
  expect(bucket.delete).toHaveBeenCalledWith(reserved.objectKey)
  expect(purgeShared).toHaveBeenCalledWith([`chat-image:${reserved.id}`])
})
it("keeps images in the order they were sent, not the order they were uploaded", async () => {
  const { value } = fixture()
  const upload = async (name: string) => {
    const reserved = await value.reserveAttachment(
      "room",
      "author",
      1,
      dailyUploads,
      false
    )
    if (!reserved) throw Error("No reservation")
    value.finishAttachment(reserved.id, "author", {
      width: 1,
      height: 1,
      bytes: 1,
      name,
      type: "image/png",
    })
    return reserved.id
  }
  // The later image is reserved first, as when its upload starts first.
  const later = await upload("later.png")
  const earlier = await upload("earlier.png")
  const sent = await value.sendMessage({
    ...input("first"),
    attachmentIds: [earlier, later],
  })
  expect(sent.attachments.map((image) => image.name)).toEqual([
    "earlier.png",
    "later.png",
  ])
})
/** A day's limit small enough to reach in a test. */
const dailyUploads = { count: 100, bytes: 500 * 1024 * 1024 }
/** An upload leaving less of the day's bytes than `overflow`. */
const overflow = 101 * 1024 * 1024
const nearlyDaily = dailyUploads.bytes - 100 * 1024 * 1024

it("limits each member's daily uploads by count and by bytes", async () => {
  const { value } = fixture()
  expect(
    await value.reserveAttachment(
      "room",
      "author",
      nearlyDaily,
      dailyUploads,
      false
    )
  ).not.toBeNull()
  expect(
    await value.reserveAttachment(
      "room",
      "author",
      overflow,
      dailyUploads,
      false
    )
  ).toBeNull()
  expect(
    await value.reserveAttachment(
      "room",
      "other",
      overflow,
      dailyUploads,
      false
    )
  ).not.toBeNull()
  const uploads = await Promise.all(
    Array.from({ length: dailyUploads.count - 1 }, () =>
      value.reserveAttachment("room", "other", 1, dailyUploads, false)
    )
  )
  expect(uploads).not.toContain(null)
  expect(
    await value.reserveAttachment("room", "other", 1, dailyUploads, false)
  ).toBeNull()
})
it("drops every cached size of a deleted room", async () => {
  const { value } = fixture()
  await Promise.all(
    ["author", "other"].map((member) =>
      value.reserveAttachment("room", member, 1, dailyUploads, false)
    )
  )
  // A card still waiting to be made goes with the room.
  await value.sendMessage({
    ...input("first"),
    content: "https://example.com/a",
  })
  await value.deleteMessages("room")
  expect(purgeShared).toHaveBeenCalledWith(["chat-room:room"])
})
it("rejects empty text-only edits and preserves idempotent sending", async () => {
  const { value } = fixture()
  const sent = await value.sendMessage(input("first"))
  expect(await value.sendMessage(input("first"))).toEqual(sent)
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      readsPrivate: false,
      id: "first",
      content: "",
    })
  ).toEqual({ error: "empty" })
})

it("does not create or advance an edit timestamp when content is unchanged", async () => {
  const { value } = fixture()
  const original = await value.sendMessage(input("first"))
  const edit = {
    roomId: "room",
    ...author,
    id: "first",
    content: "original",
  }
  expect(await value.changeMessage(edit)).toEqual({
    message: original,
    changed: false,
  })
  const changed = await value.changeMessage({ ...edit, content: "updated" })
  expect(changed).toMatchObject({
    changed: true,
    message: { editedAt: expect.any(String) },
  })
  expect(await value.changeMessage({ ...edit, content: "updated" })).toEqual({
    ...changed,
    changed: false,
  })
  expect(
    await value.changeMessage({
      ...edit,
      memberId: "other",
      content: "updated",
    })
  ).toEqual({ error: "forbidden" })
})

it("searches Japanese and literal punctuation across history, newest first, excluding deletions and reflecting edits", async () => {
  const { value } = fixture()
  await value.sendMessage({ ...input("one"), content: "集合場所 100%" })
  await value.sendMessage({ ...input("two"), content: "集合場所 100%" })
  await value.sendMessage({ ...input("three"), content: "OTHER" })
  const first = value.searchMessages("集合", null, 1, author)
  expect(first.messages.map((message) => message.id)).toEqual(["two"])
  expect(first.hasMore).toBe(true)
  expect(
    value
      .searchMessages("集合", first.messages[0]?.sequence ?? 0, 1, author)
      .messages.map((message) => message.id)
  ).toEqual(["one"])
  expect(value.searchMessages("%", null, 30, author).messages).toHaveLength(2)
  expect(value.searchMessages("other", null, 30, author).messages[0]?.id).toBe(
    "three"
  )
  await value.changeMessage({
    roomId: "room",
    memberId: "author",
    readsPrivate: false,
    id: "two",
  })
  await value.changeMessage({
    roomId: "room",
    memberId: "author",
    readsPrivate: false,
    id: "one",
    content: "移動",
  })
  expect(value.searchMessages("集合", null, 30, author).messages).toEqual([])
})

it("pages history newest first and offers older pages only while visible messages remain", async () => {
  const { value } = fixture()
  await value.sendMessage({ ...input("one"), content: "one" })
  await value.sendMessage({ ...input("two"), content: "two" })
  await value.sendMessage({ ...input("three"), content: "three" })
  await value.sendMessage({ ...input("four"), content: "four" })
  const first = value.getMessages(null, 2, author)
  expect(first.messages.map((message) => message.id)).toEqual(["three", "four"])
  expect(first.hasMore).toBe(true)
  await value.changeMessage({
    roomId: "room",
    memberId: "author",
    readsPrivate: false,
    id: "one",
  })
  await value.changeMessage({
    roomId: "room",
    memberId: "author",
    readsPrivate: false,
    id: "two",
  })
  expect(value.getMessages(null, 2, author).hasMore).toBe(false)
  const rest = value.getMessages(first.messages[0]?.sequence ?? 0, 2, author)
  expect(rest.messages.map((message) => message.id)).toEqual(["one", "two"])
  expect(rest.hasMore).toBe(false)
  expect(value.getMessages(1, 2, author)).toEqual({
    messages: [],
    hasMore: false,
  })
})

it("raises a message's version with every change, and only then", async () => {
  const { value } = fixture()
  vi.mocked(makeLinkCard).mockResolvedValue(card("a"))
  const sent = await value.sendMessage({
    ...input("first"),
    content: "https://example.com/a",
  })
  expect(sent.version).toBe(1)
  expect(
    await value.sendMessage({
      ...input("first"),
      content: "https://example.com/a",
    })
  ).toMatchObject({ version: 1 })
  await value.alarm()
  expect(value.getMessages(null, 100, author).messages[0]?.version).toBe(2)
  expect(
    await value.changeMessage(editFirst("https://example.com/a"))
  ).toMatchObject({ changed: false, message: { version: 2 } })
  expect(
    await value.changeMessage(editFirst("https://example.com/a again"))
  ).toMatchObject({ message: { version: 3 } })
  expect(await value.changeMessage(editFirst())).toMatchObject({
    message: { version: 4, deleted: true },
  })
})

it("gives back an unsent upload's share of the day when it is removed", async () => {
  const { value } = fixture()
  const large = await value.reserveAttachment(
    "room",
    "author",
    nearlyDaily,
    dailyUploads,
    false
  )
  if (!large) throw Error("No reservation")
  expect(
    await value.reserveAttachment(
      "room",
      "author",
      overflow,
      dailyUploads,
      false
    )
  ).toBeNull()
  expect(await value.deleteAttachment(large.id, "author")).toBe(true)
  expect(
    await value.reserveAttachment(
      "room",
      "author",
      overflow,
      dailyUploads,
      false
    )
  ).not.toBeNull()
  const uploads = await Promise.all(
    Array.from({ length: dailyUploads.count - 1 }, () =>
      value.reserveAttachment("room", "author", 1, dailyUploads, false)
    )
  )
  expect(
    await value.reserveAttachment("room", "author", 1, dailyUploads, false)
  ).toBeNull()
  const first = uploads[0]
  if (!first) throw Error("No reservation")
  await value.deleteAttachment(first.id, "author")
  expect(
    await value.reserveAttachment("room", "author", 1, dailyUploads, false)
  ).not.toBeNull()
  // Removing twice gives nothing more back.
  expect(await value.deleteAttachment(first.id, "author")).toBe(false)
})

it("waits for a display copy's original, counting its bytes, then tells the room", async () => {
  const { value } = fixture()
  const reserved = await value.reserveAttachment(
    "room",
    "author",
    50,
    dailyUploads,
    true
  )
  if (!reserved) throw Error("No reservation")
  value.finishAttachment(reserved.id, "author", {
    width: 10,
    height: 10,
    bytes: 50,
    name: "copy.webp",
    type: "image/webp",
  })
  const sent = await value.sendMessage({
    ...input("first"),
    attachmentIds: [reserved.id],
  })
  expect(sent.attachments[0]?.original).toBe(false)
  expect(value.reserveOriginal(reserved.id, "other", 100, dailyUploads)).toBe(
    "missing"
  )
  expect(
    value.reserveOriginal(
      reserved.id,
      "author",
      dailyUploads.bytes,
      dailyUploads
    )
  ).toBe("limit")
  expect(
    value.reserveOriginal(reserved.id, "author", 100, dailyUploads)
  ).toEqual({ objectKey: reserved.objectKey })
  vi.mocked(publishChatEvent).mockClear()
  expect(
    await value.finishOriginal("room", reserved.id, "author", {
      width: 30,
      height: 40,
      bytes: 100,
      name: "photo.jpg",
      type: "image/jpeg",
    })
  ).toBe(true)
  const [message] = value.getMessages(null, 10, author).messages
  expect(message?.attachments[0]).toMatchObject({
    original: true,
    width: 30,
    height: 40,
    name: "photo.jpg",
  })
  expect(message?.version).toBe(sent.version + 1)
  expect(publishChatEvent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ type: "message_changed", roomId: "room" })
  )
  // An original that has arrived is never replaced again.
  expect(value.reserveOriginal(reserved.id, "author", 100, dailyUploads)).toBe(
    "missing"
  )
})
it("lets a display copy stand as its original when the original is lost", async () => {
  const { value } = fixture()
  const reserved = await value.reserveAttachment(
    "room",
    "author",
    50,
    dailyUploads,
    true
  )
  if (!reserved) throw Error("No reservation")
  value.finishAttachment(reserved.id, "author", {
    width: 10,
    height: 10,
    bytes: 50,
    name: "copy.webp",
    type: "image/webp",
  })
  await value.sendMessage({ ...input("first"), attachmentIds: [reserved.id] })
  expect(await value.keepCopy("room", reserved.id, "other")).toBe(false)
  expect(await value.keepCopy("room", reserved.id, "author")).toBe(true)
  expect(
    value.getMessages(null, 10, author).messages[0]?.attachments[0]?.original
  ).toBe(true)
  expect(await value.keepCopy("room", reserved.id, "author")).toBe(false)
})

const notice = {
  id: "10000000-0000-4000-8000-00000000000a",
  botId: "bot",
  botName: "勤怠通知",
  content: "【遅刻】 本人",
  createdAt: 50,
  privateTo: { memberId: "reporter", displayName: "本人" },
}
const reporter = { memberId: "reporter", readsPrivate: false }
const keeper = { memberId: "keeper", readsPrivate: true }
const participant = { memberId: "participant", readsPrivate: false }

it("shows a private notice to its member and the shift's keepers only, in history and search", async () => {
  const { value } = fixture()
  await value.sendMessage({ ...input("first"), content: "集合は正門" })
  value.postBotMessage({ ...notice, content: "【遅刻】 本人 集合" })
  const ids = (reader: typeof author) =>
    value.getMessages(null, 10, reader).messages.map((message) => message.id)
  expect(ids(reporter)).toEqual(["first", notice.id])
  expect(ids(keeper)).toEqual(["first", notice.id])
  expect(ids(participant)).toEqual(["first"])
  expect(
    value.searchMessages("集合", null, 10, participant).messages
  ).toHaveLength(1)
  expect(value.searchMessages("集合", null, 10, keeper).messages).toHaveLength(
    2
  )
  expect(value.getMessages(null, 10, keeper).messages[1]).toMatchObject({
    bot: true,
    privateTo: notice.privateTo,
  })
  // Older history is worth loading only when the reader can see some of it.
  expect(value.getMessages(2, 1, participant)).toEqual({
    messages: [expect.objectContaining({ id: "first" })],
    hasMore: false,
  })
})

it("keeps a reply to a private notice among its readers, and refuses anyone else", async () => {
  const { value } = fixture()
  value.postBotMessage(notice)
  const reply = await value.sendMessage({
    ...input("reply"),
    ...keeper,
    replyToId: notice.id,
  })
  expect(reply.privateTo).toEqual(notice.privateTo)
  expect(
    value.getMessages(null, 10, participant).messages.map((item) => item.id)
  ).toEqual([])
  expect(
    value.getMessages(null, 10, reporter).messages.map((item) => item.id)
  ).toEqual([notice.id, "reply"])
  await expect(
    value.sendMessage({
      ...input("peek"),
      ...participant,
      replyToId: notice.id,
    })
  ).rejects.toThrow("INVALID_CHAT_REPLY")
  // Someone who cannot read it cannot change it either, even as a manager.
  expect(
    await value.changeMessage({ roomId: "room", ...participant, id: "reply" })
  ).toEqual({ error: "not_found" })
  expect(
    await value.changeMessage({ roomId: "room", ...keeper, id: notice.id })
  ).toEqual({ error: "forbidden" })
})

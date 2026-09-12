import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { ChatRoom } from "../src/durable-objects/chat-room"
import { findAccessibleRoom, type RoomRow } from "../src/services/chat-access"
import { roomRecipients } from "../src/services/chat-permissions"
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown
    ) {}
  },
}))
vi.mock("../src/services/chat-access", () => ({
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
vi.mock("../src/services/chat-permissions", () => ({
  roomRecipients: vi.fn<typeof roomRecipients>(),
}))
const room: RoomRow = {
  id: "room",
  year: 2026,
  name: "room",
  createdBy: "author",
  createdAt: 0,
  updatedAt: 0,
  allowExit: 1,
  activityId: null,
  activityStartsAt: null,
  activityEndsAt: null,
  canPost: 1,
  canManage: 0,
  muted: 0,
  lastRead: 0,
  lastSequence: 0,
  exitedAt: null,
}
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
    { CHAT_IMAGES: bucket },
  ])
  if (!(value instanceof ChatRoom)) throw Error("Invalid room")
  return { value, db, bucket, storage }
}
const input = (id: string) => ({
  roomId: "room",
  id,
  memberId: "author",
  memberDisplayName: "Author",
  content: "original",
  createdAt: 100,
  attachmentIds: [],
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
  expect(value.getMessages(null, 100, null).messages[1]?.reply?.content).toBe(
    "edited"
  )
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      id: "first",
    })
  ).toMatchObject({ message: { deleted: true, content: "", attachments: [] } })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      id: "first",
    })
  ).toMatchObject({ message: { deleted: true, content: "" } })
  const messages = value.getMessages(null, 100, null).messages
  expect(messages.map((m) => m.sequence)).toEqual([1, 2])
  expect(messages[1]?.reply).toMatchObject({ deleted: true, content: "" })
  await expect(
    value.sendMessage({ ...input("third"), replyToId: "first" })
  ).rejects.toThrow("INVALID_CHAT_REPLY")
  await expect(
    value.sendMessage({ ...input("fourth"), replyToId: "another-room-message" })
  ).rejects.toThrow("INVALID_CHAT_REPLY")
})
it("enforces authorship, manager deletion, revoked access and historical access inside the room", async () => {
  const { value } = fixture()
  await value.sendMessage(input("first"))
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      id: "first",
      content: "bad",
    })
  ).toEqual({ error: "forbidden" })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      id: "first",
    })
  ).toEqual({ error: "forbidden" })
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, canManage: 1 })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      id: "first",
      content: "bad",
    })
  ).toEqual({ error: "forbidden" })
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, exitedAt: 150 })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      id: "first",
    })
  ).toEqual({ error: "forbidden" })
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      id: "first",
    })
  ).toEqual({ error: "not_found" })
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, canManage: 1 })
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "other",
      id: "first",
    })
  ).toMatchObject({ message: { deleted: true } })
})
it("denies image reads immediately after deletion and removes their objects on the alarm", async () => {
  const { value, bucket } = fixture()
  const reserved = await value.reserveAttachment("room", "author")
  if (!reserved) throw Error("No reservation")
  value.finishAttachment(reserved.id, "author", {
    width: 10,
    height: 10,
    bytes: 50,
  })
  await value.sendMessage({ ...input("first"), attachmentIds: [reserved.id] })
  expect(value.getAttachment(reserved.id, null)).not.toBeNull()
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      id: "first",
      content: "",
    })
  ).toMatchObject({ message: { content: "" } })
  await value.changeMessage({ roomId: "room", memberId: "author", id: "first" })
  expect(value.getAttachment(reserved.id, null)).toBeNull()
  await value.alarm()
  expect(bucket.delete).toHaveBeenCalledWith(reserved.objectKey)
})
it("rejects empty text-only edits and preserves idempotent sending", async () => {
  const { value } = fixture()
  const sent = await value.sendMessage(input("first"))
  expect(await value.sendMessage(input("first"))).toEqual(sent)
  expect(
    await value.changeMessage({
      roomId: "room",
      memberId: "author",
      id: "first",
      content: "",
    })
  ).toEqual({ error: "empty" })
})

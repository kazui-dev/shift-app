import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { appUsers } from "./account"
import { operatingYears } from "./organization"
import { activities } from "./activities"

export const chatRooms = sqliteTable(
  "chat_rooms",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    allowExit: integer("allow_exit", { mode: "boolean" })
      .notNull()
      .default(true),
    lastSequence: integer("last_sequence").notNull().default(0),
    name: text("name").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("chat_rooms_year_updatedAt_idx").on(table.year, table.updatedAt),
  ]
)

export const activityChatRooms = sqliteTable(
  "activity_chat_rooms",
  {
    activityId: text("activity_id")
      .primaryKey()
      .references(() => activities.id, { onDelete: "cascade" }),
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("activity_chat_rooms_room_uidx").on(table.roomId)]
)

/**
 * A sender that is not a person. Rows are seeded, not created at runtime, and
 * a bot's key is how the code asks for it.
 */
export const bots = sqliteTable(
  "bots",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("bots_key_uidx").on(table.key)]
)

/** The rooms a bot belongs to; it reads nothing and only posts. */

export const chatRoomBots = sqliteTable(
  "chat_room_bots",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.botId] })]
)

export const chatRoomTargets = sqliteTable(
  "chat_room_targets",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    targetType: text("target_type", {
      enum: [
        "member",
        "role",
        "activity",
        "year",
        "access_level",
        "permission",
        "responsible",
      ],
    }).notNull(),
    targetId: text("target_id").notNull(),
    canRead: integer("can_read", { mode: "boolean" }).notNull().default(true),
    canPost: integer("can_post", { mode: "boolean" }).notNull().default(true),
    canManage: integer("can_manage", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.targetType, table.targetId] }),
    index("chat_room_targets_lookup_idx").on(
      table.targetType,
      table.targetId,
      table.roomId
    ),
  ]
)

export const chatRoomPreferences = sqliteTable(
  "chat_room_preferences",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    lastRead: integer("last_read").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.memberId] })]
)

/**
 * Who wrote each message of a room and whether it still stands, so unread
 * counts can be taken in D1 while message bodies stay in the room's storage.
 */
export const chatMessageIndex = sqliteTable(
  "chat_message_index",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    memberId: text("member_id").notNull(),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    /**
     * Set on a message only the named member and the shift's responsibles may
     * read, so nobody else counts it as unread.
     */
    privateTo: text("private_to"),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.sequence] })]
)

/** Every change to an assignment's attendance, by the member or a responsible. */

// Durable Object cleanup survives the transaction that removes the room.
export const chatRoomDeletions = sqliteTable("chat_room_deletions", {
  roomId: text("room_id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const chatRoomExits = sqliteTable(
  "chat_room_exits",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.memberId] })]
)

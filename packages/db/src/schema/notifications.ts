import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { appUsers } from "./account"
import { shiftAssignments } from "./shifts"

export const notificationDevices = sqliteTable(
  "notification_devices",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    endpoint: text("endpoint"),
    expirationTime: integer("expiration_time", { mode: "timestamp_ms" }),
    p256dh: text("p256dh"),
    auth: text("auth"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("notification_devices_endpoint_uidx").on(table.endpoint),
    index("notification_devices_member_idx").on(table.memberId),
  ]
)

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => shiftAssignments.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => notificationDevices.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["ten_minute"] }).notNull(),
    status: text("status", { enum: ["claimed", "sent"] })
      .notNull()
      .default("claimed"),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    primaryKey({
      columns: [table.assignmentId, table.subscriptionId, table.kind],
    }),
    index("notification_deliveries_status_claimedAt_idx").on(
      table.status,
      table.claimedAt
    ),
  ]
)

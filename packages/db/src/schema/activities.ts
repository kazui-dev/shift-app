import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"
import { appUsers } from "./account"
import { operatingYears, yearRoles } from "./organization"

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    place: text("place").notNull(),
    activityType: text("activity_type").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    color: text("color").notNull(),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("activities_year_startsAt_idx").on(table.year, table.startsAt),
    check(
      "activities_time_order_check",
      sql`${table.startsAt} < ${table.endsAt}`
    ),
  ]
)

export const activityResponsibles = sqliteTable(
  "activity_responsibles",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["member", "role"] }).notNull(),
    targetId: text("target_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.activityId, table.targetType, table.targetId],
    }),
  ]
)

export const activityHistory = sqliteTable("activity_history", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  actorId: text("actor_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  before: text("before").notNull(),
  after: text("after").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const activityCandidateRoles = sqliteTable(
  "activity_candidate_roles",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => yearRoles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.roleId] })]
)

export const activityNotifications = sqliteTable(
  "activity_notifications",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status", { enum: ["pending", "sent"] })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.memberId, table.version] }),
  ]
)

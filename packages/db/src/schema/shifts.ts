import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { appUsers } from "./account"
import { studentDirectory } from "./organization"
import { activities } from "./activities"

export const shiftSlots = sqliteTable(
  "shift_slots",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    capacity: integer("capacity"),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    check("shift_slots_time_check", sql`${table.startsAt} < ${table.endsAt}`),
  ]
)

export const shiftAssignments = sqliteTable(
  "shift_assignments",
  {
    id: text("id").primaryKey(),
    slotId: text("slot_id")
      .notNull()
      .references(() => shiftSlots.id, { onDelete: "restrict" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    notes: text("notes"),
    status: text("status", { enum: ["active", "cancelled"] })
      .notNull()
      .default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    cancelledBy: text("cancelled_by").references(() => appUsers.id, {
      onDelete: "restrict",
    }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("shift_assignments_slot_member_uidx")
      .on(table.slotId, table.memberId)
      .where(sql`${table.status} = 'active'`),
    index("shift_assignments_member_idx").on(table.memberId),
  ]
)

/**
 * An assignment's attendance: late or absent with the expected arrival and
 * reason, or present with the check-in. Taking back late or absent removes it.
 */
export const assignmentAttendance = sqliteTable(
  "assignment_attendance",
  {
    assignmentId: text("assignment_id")
      .primaryKey()
      .references(() => shiftAssignments.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    state: text("state", { enum: ["late", "absent", "present"] }).notNull(),
    expectedAt: integer("expected_at", { mode: "timestamp_ms" }),
    reason: text("reason").notNull().default(""),
    checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }),
    checkInStatus: text("check_in_status", { enum: ["pending", "confirmed"] }),
    resolvedBy: text("resolved_by").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("assignment_attendance_member_state_idx").on(
      table.memberId,
      table.state
    ),
  ]
)

export const assignmentAttendanceEvents = sqliteTable(
  "assignment_attendance_events",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => shiftAssignments.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    action: text("action", {
      enum: [
        "late",
        "absent",
        "withdrawn",
        "checked_in",
        "corrected",
        "resolved",
      ],
    }).notNull(),
    expectedAt: integer("expected_at", { mode: "timestamp_ms" }),
    checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }),
    previousCheckedInAt: integer("previous_checked_in_at", {
      mode: "timestamp_ms",
    }),
    reason: text("reason").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("assignment_attendance_events_assignment_idx").on(
      table.assignmentId,
      table.createdAt
    ),
  ]
)

export const directoryShiftAssignments = sqliteTable(
  "directory_shift_assignments",
  {
    id: text("id").primaryKey(),
    slotId: text("slot_id")
      .notNull()
      .references(() => shiftSlots.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => studentDirectory.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("directory_assignments_slot_entry_uidx").on(
      table.slotId,
      table.entryId
    ),
  ]
)

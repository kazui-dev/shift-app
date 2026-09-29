import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { appUsers } from "./account"
import { operatingYears, studentDirectory } from "./organization"

export const availabilitySubmissions = sqliteTable(
  "availability_submissions",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "submitted"] })
      .notNull()
      .default("draft"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    revision: integer("revision").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("availability_submissions_year_member_uidx").on(
      table.year,
      table.memberId
    ),
  ]
)

export const availabilityDates = sqliteTable(
  "availability_dates",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    date: text("date").notNull(),
    startsMinute: integer("starts_minute").notNull().default(0),
    endsMinute: integer("ends_minute").notNull().default(1440),
    accepting: integer("accepting", { mode: "boolean" })
      .notNull()
      .default(true),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("availability_dates_year_date_uidx").on(table.year, table.date),
    check(
      "availability_dates_format_check",
      sql`${table.date} = date(${table.date})`
    ),
  ]
)

export const availabilityWindows = sqliteTable(
  "availability_windows",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => availabilitySubmissions.id, { onDelete: "cascade" }),
    availabilityDateId: text("availability_date_id")
      .notNull()
      .references(() => availabilityDates.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("availability_windows_submission_startsAt_idx").on(
      table.submissionId,
      table.startsAt
    ),
    index("availability_windows_date_idx").on(table.availabilityDateId),
    check(
      "availability_windows_time_order_check",
      sql`${table.startsAt} < ${table.endsAt}`
    ),
  ]
)

export const availabilityDrafts = sqliteTable(
  "availability_drafts",
  {
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    answers: text("answers").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.year, table.memberId] })]
)

export const availabilityDayAnswers = sqliteTable(
  "availability_day_answers",
  {
    submissionId: text("submission_id")
      .notNull()
      .references(() => availabilitySubmissions.id, { onDelete: "cascade" }),
    dateId: text("date_id")
      .notNull()
      .references(() => availabilityDates.id, { onDelete: "cascade" }),
    dateVersion: integer("date_version").notNull(),
    choice: text("choice", { enum: ["all", "times", "no"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.submissionId, table.dateId] })]
)

export const availabilitySubmissionChanges = sqliteTable(
  "availability_submission_changes",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => availabilitySubmissions.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    beforeChoice: text("before_choice", {
      enum: ["all", "times", "no", "unanswered"],
    }).notNull(),
    beforeTimes: text("before_times").notNull(),
    afterChoice: text("after_choice", {
      enum: ["all", "times", "no"],
    }).notNull(),
    afterTimes: text("after_times").notNull(),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("availability_changes_submission_changed_idx").on(
      table.submissionId,
      table.changedAt
    ),
  ]
)

// Temporary directory-owned work for external survey responses; see docs/compatibility.md.
export const directoryAvailabilitySubmissions = sqliteTable(
  "directory_availability_submissions",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .unique()
      .references(() => studentDirectory.id, { onDelete: "cascade" }),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  }
)

export const directoryAvailabilityDayAnswers = sqliteTable(
  "directory_availability_day_answers",
  {
    submissionId: text("submission_id")
      .notNull()
      .references(() => directoryAvailabilitySubmissions.id, {
        onDelete: "cascade",
      }),
    dateId: text("date_id")
      .notNull()
      .references(() => availabilityDates.id, { onDelete: "cascade" }),
    dateVersion: integer("date_version").notNull(),
    choice: text("choice", { enum: ["all", "times", "no"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.submissionId, table.dateId] })]
)

export const directoryAvailabilityWindows = sqliteTable(
  "directory_availability_windows",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => directoryAvailabilitySubmissions.id, {
        onDelete: "cascade",
      }),
    availabilityDateId: text("availability_date_id")
      .notNull()
      .references(() => availabilityDates.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "directory_windows_time_order_check",
      sql`${table.startsAt} < ${table.endsAt}`
    ),
  ]
)

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

export const operatingYears = sqliteTable("operating_years", {
  year: integer("year").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

/**
 * A bureau of the committee in a year. The role it names is what belonging to
 * the bureau grants on sign-in.
 */
export const bureaus = sqliteTable(
  "bureaus",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleId: text("role_id").references(() => yearRoles.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("bureaus_year_name_nocase_uidx").on(
      table.year,
      sql`lower(${table.name})`
    ),
  ]
)

/**
 * A duty within a bureau. Two bureaus may name a duty alike, so a name is
 * unique to its bureau rather than to the year.
 */
export const duties = sqliteTable(
  "duties",
  {
    id: text("id").primaryKey(),
    bureauId: text("bureau_id")
      .notNull()
      .references(() => bureaus.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleId: text("role_id").references(() => yearRoles.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("duties_bureau_name_nocase_uidx").on(
      table.bureauId,
      sql`lower(${table.name})`
    ),
  ]
)

/**
 * The committee's list of students for a year: the student ID and name a member
 * signs in with while Discord OAuth is off, the bureau they belong to, and the
 * office they hold. It holds no account data, only what the sign-in must match
 * and grant.
 */
export const studentDirectory = sqliteTable(
  "student_directory",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    studentId: text("student_id").notNull(),
    displayName: text("display_name").notNull(),
    bureauId: text("bureau_id").references(() => bureaus.id, {
      onDelete: "set null",
    }),
    /** 局長 and the like: the committee's own record, granted to no one. */
    office: text("office"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("student_directory_year_studentId_nocase_uidx").on(
      table.year,
      sql`lower(${table.studentId})`
    ),
    index("student_directory_bureau_idx").on(table.bureauId),
  ]
)

/** The duties a listing holds; a member may hold more than one. */

export const directoryDuties = sqliteTable(
  "directory_duties",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => studentDirectory.id, { onDelete: "cascade" }),
    dutyId: text("duty_id")
      .notNull()
      .references(() => duties.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.dutyId] }),
    index("directory_duties_duty_idx").on(table.dutyId),
  ]
)

export const yearSettings = sqliteTable(
  "year_settings",
  {
    id: integer("id").primaryKey(),
    defaultYear: integer("default_year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "restrict" }),
  },
  (table) => [check("year_settings_singleton_check", sql`${table.id} = 1`)]
)

export const userPreferences = sqliteTable("user_preferences", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  selectedYear: integer("selected_year").references(() => operatingYears.year, {
    onDelete: "set null",
  }),
})

export const yearMemberships = sqliteTable(
  "year_memberships",
  {
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "inactive"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.year, table.memberId] }),
    index("year_memberships_member_status_idx").on(
      table.memberId,
      table.status,
      table.year
    ),
  ]
)

export const yearRoles = sqliteTable(
  "year_roles",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("year_roles_year_name_nocase_uidx").on(
      table.year,
      sql`lower(${table.name})`
    ),
  ]
)

export const yearRolePermissions = sqliteTable(
  "year_role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => yearRoles.id, { onDelete: "cascade" }),
    permission: text("permission", {
      enum: ["shift.create", "shift.manage", "member.manage", "role.manage"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permission] }),
    index("year_role_permissions_permission_idx").on(table.permission),
  ]
)

export const memberYearRoles = sqliteTable(
  "member_year_roles",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => yearRoles.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.roleId] }),
    index("member_year_roles_role_idx").on(table.roleId),
  ]
)

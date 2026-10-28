import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { operatingYears, yearRoles } from "./organization"
import { appUsers } from "./account"

export const yearAttendanceSettings = sqliteTable("year_attendance_settings", {
  year: integer("year")
    .primaryKey()
    .references(() => operatingYears.year, { onDelete: "cascade" }),
  noticeAudience: text("notice_audience", {
    enum: ["selected", "room_members"],
  })
    .notNull()
    .default("selected"),
})
export const attendanceNoticeRoles = sqliteTable(
  "attendance_notice_roles",
  {
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => yearRoles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.year, table.roleId] })]
)
export const attendanceNoticeMembers = sqliteTable(
  "attendance_notice_members",
  {
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.year, table.memberId] })]
)

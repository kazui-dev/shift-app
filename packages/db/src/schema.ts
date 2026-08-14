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

import { user } from "./auth-schema"

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    studentId: text("student_id").notNull(),
    accessLevel: text("access_level", {
      enum: ["system_admin", "leader", "member"],
    })
      .notNull()
      .default("member"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("members_userId_uidx").on(table.userId),
    uniqueIndex("members_studentId_nocase_uidx").on(
      sql`lower(${table.studentId})`
    ),
  ]
)

export const affiliationVerifications = sqliteTable(
  "affiliation_verifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerId: text("provider_id", { enum: ["discord"] }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    organizationId: text("organization_id").notNull(),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("affiliation_provider_account_uidx").on(
      table.providerId,
      table.providerAccountId
    ),
    index("affiliation_userId_idx").on(table.userId),
  ]
)

export const identityLinkRequests = sqliteTable(
  "identity_link_requests",
  {
    id: text("id").primaryKey(),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetMemberId: text("target_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled"],
    })
      .notNull()
      .default("pending"),
    decidedBy: text("decided_by").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("identity_link_requester_pending_uidx")
      .on(table.requesterUserId)
      .where(sql`${table.status} = 'pending'`),
    index("identity_link_target_idx").on(table.targetMemberId),
  ]
)

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorType: text("actor_type", {
      enum: ["system_admin", "cloudflare_operator"],
    }).notNull(),
    action: text("action").notNull(),
    targetMemberId: text("target_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    details: text("details"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("admin_audit_actor_idx").on(table.actorUserId),
    index("admin_audit_target_idx").on(table.targetMemberId),
  ]
)

export const operatingYears = sqliteTable("operating_years", {
  year: integer("year").primaryKey(),
  name: text("name").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  status: text("status", { enum: ["draft", "active", "archived"] })
    .notNull()
    .default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const yearRoles = sqliteTable(
  "year_roles",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
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
    permission: text("permission", { enum: ["shift.manage"] }).notNull(),
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
      .references(() => members.id, { onDelete: "cascade" }),
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

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    name: text("name").notNull(),
    place: text("place").notNull(),
    activityType: text("activity_type").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    color: text("color").notNull(),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
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

export const availabilitySubmissions = sqliteTable(
  "availability_submissions",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "submitted"] })
      .notNull()
      .default("draft"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
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

export const availabilityWindows = sqliteTable(
  "availability_windows",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => availabilitySubmissions.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("availability_windows_submission_startsAt_idx").on(
      table.submissionId,
      table.startsAt
    ),
    check(
      "availability_windows_time_order_check",
      sql`${table.startsAt} < ${table.endsAt}`
    ),
  ]
)

export const shiftAssignments = sqliteTable(
  "shift_assignments",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    notes: text("notes"),
    status: text("status", { enum: ["active", "cancelled"] })
      .notNull()
      .default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    cancelledBy: text("cancelled_by").references(() => members.id, {
      onDelete: "restrict",
    }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("shift_assignments_activity_member_time_uidx")
      .on(table.activityId, table.memberId, table.startsAt, table.endsAt)
      .where(sql`${table.status} = 'active'`),
    index("shift_assignments_member_startsAt_idx").on(
      table.memberId,
      table.startsAt
    ),
    check(
      "shift_assignments_time_order_check",
      sql`${table.startsAt} < ${table.endsAt}`
    ),
  ]
)

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => shiftAssignments.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("attendance_records_assignment_uidx").on(table.assignmentId),
    index("attendance_records_member_checkedInAt_idx").on(
      table.memberId,
      table.checkedInAt
    ),
  ]
)

export const assignmentReports = sqliteTable(
  "assignment_reports",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => shiftAssignments.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["late", "absence"] }).notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "resolved"] })
      .notNull()
      .default("open"),
    resolvedBy: text("resolved_by").references(() => members.id, {
      onDelete: "set null",
    }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("assignment_reports_assignment_uidx").on(table.assignmentId),
    index("assignment_reports_status_createdAt_idx").on(
      table.status,
      table.createdAt
    ),
  ]
)

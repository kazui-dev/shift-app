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

export const appUsers = sqliteTable(
  "app_users",
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
    uniqueIndex("app_users_userId_uidx").on(table.userId),
    uniqueIndex("app_users_studentId_nocase_uidx").on(
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
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled"],
    })
      .notNull()
      .default("pending"),
    decidedBy: text("decided_by").references(() => appUsers.id, {
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
    targetMemberId: text("target_member_id").references(() => appUsers.id, {
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
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

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

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => shiftAssignments.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "confirmed"] })
      .notNull()
      .default("confirmed"),
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
      .references(() => appUsers.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["late", "absence"] }).notNull(),
    eta: integer("eta", { mode: "timestamp_ms" }),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "resolved", "withdrawn"] })
      .notNull()
      .default("open"),
    resolvedBy: text("resolved_by").references(() => appUsers.id, {
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

export const chatRooms = sqliteTable(
  "chat_rooms",
  {
    id: text("id").primaryKey(),
    year: integer("year")
      .notNull()
      .references(() => operatingYears.year, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["custom", "global", "shift"] })
      .notNull()
      .default("custom"),
    activityId: text("activity_id").references(() => activities.id, {
      onDelete: "cascade",
    }),
    lastSequence: integer("last_sequence").notNull().default(0),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("chat_rooms_activity_uidx").on(table.activityId),
    uniqueIndex("chat_rooms_global_year_uidx")
      .on(table.year)
      .where(sql`${table.kind} = 'global'`),
    index("chat_rooms_year_status_updatedAt_idx").on(
      table.year,
      table.status,
      table.updatedAt
    ),
  ]
)

export const chatRoomTargets = sqliteTable(
  "chat_room_targets",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    targetType: text("target_type", {
      enum: ["member", "role", "activity"],
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

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
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
    uniqueIndex("push_subscriptions_endpoint_uidx").on(table.endpoint),
    index("push_subscriptions_member_idx").on(table.memberId),
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
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
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

export const chatRoomAccess = sqliteTable(
  "chat_room_access",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    exitedAt: integer("exited_at", { mode: "timestamp_ms" }),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.memberId] })]
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

export const reportEvents = sqliteTable("report_events", {
  id: text("id").primaryKey(),
  reportId: text("report_id")
    .notNull()
    .references(() => assignmentReports.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  details: text("details").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})
export const attendanceEvents = sqliteTable("attendance_events", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id")
    .notNull()
    .references(() => shiftAssignments.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  before: integer("before", { mode: "timestamp_ms" }),
  after: integer("after", { mode: "timestamp_ms" }).notNull(),
  reason: text("reason").notNull(),
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

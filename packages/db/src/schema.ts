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

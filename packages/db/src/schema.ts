import { sql } from "drizzle-orm"
import {
  index,
  integer,
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
    providerId: text("provider_id", { enum: ["discord"] })
      .notNull(),
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

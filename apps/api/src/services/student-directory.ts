import { and, eq, inArray, sql } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

import {
  appUsers,
  memberYearRoles,
  studentDirectory,
  yearMemberships,
  yearRoles,
  yearSettings,
} from "@workspace/db/schema"

type Db = DrizzleD1Database<Record<string, unknown>>

export type DirectoryEntry = {
  year: number
  studentId: string
  displayName: string
  /** The bureau and duty are optional; a listing may name neither. */
  bureau: string | null
  duty: string | null
}

/** The year whose directory decides who may sign in. */
export async function readDirectoryYear(db: Db): Promise<number | null> {
  const [settings] = await db
    .select({ year: yearSettings.defaultYear })
    .from(yearSettings)
    .where(eq(yearSettings.id, 1))
    .limit(1)
  return settings?.year ?? null
}

/** The directory row for a student ID in a year, matched without case. */
export async function findDirectoryEntry(
  db: Db,
  year: number,
  studentId: string
): Promise<DirectoryEntry | null> {
  const [entry] = await db
    .select({
      year: studentDirectory.year,
      studentId: studentDirectory.studentId,
      displayName: studentDirectory.displayName,
      bureau: studentDirectory.bureau,
      duty: studentDirectory.duty,
    })
    .from(studentDirectory)
    .where(
      and(
        eq(studentDirectory.year, year),
        sql`lower(${studentDirectory.studentId}) = ${studentId.toLowerCase()}`
      )
    )
    .limit(1)
  return entry ?? null
}

export type DirectoryMember = {
  id: string
  userId: string
  displayName: string
}

/** The member holding a student ID, whichever identity created it. */
export async function findMemberByStudentId(
  db: Db,
  studentId: string
): Promise<DirectoryMember | null> {
  const [member] = await db
    .select({
      id: appUsers.id,
      userId: appUsers.userId,
      displayName: appUsers.displayName,
    })
    .from(appUsers)
    .where(sql`lower(${appUsers.studentId}) = ${studentId.toLowerCase()}`)
    .limit(1)
  return member ?? null
}

/** Creates the member a verified directory entry describes. */
export async function createDirectoryMember(
  db: Db,
  userId: string,
  entry: DirectoryEntry
): Promise<string> {
  const id = crypto.randomUUID()
  const now = new Date()
  await db.insert(appUsers).values({
    id,
    userId,
    displayName: entry.displayName,
    studentId: entry.studentId,
    accessLevel: "member",
    createdAt: now,
    updatedAt: now,
  })
  return id
}

/** Keeps a member's name as the directory spells it. */
export async function renameMember(
  db: Db,
  memberId: string,
  displayName: string
): Promise<void> {
  await db
    .update(appUsers)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(appUsers.id, memberId))
}

/**
 * Gives the member what the directory lists for the year: an active
 * participation, and the year roles named by their bureau and duty when the
 * listing names them. Roles an administrator added stay; nothing is revoked.
 */
export async function applyDirectoryPlacement(
  db: Db,
  memberId: string,
  entry: DirectoryEntry
): Promise<void> {
  const now = new Date()
  await db
    .insert(yearMemberships)
    .values({
      year: entry.year,
      memberId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [yearMemberships.year, yearMemberships.memberId],
      set: { status: "active", updatedAt: now },
    })

  const named = [entry.bureau, entry.duty].filter(
    (name): name is string => name !== null && name.length > 0
  )
  if (named.length === 0) return

  const roles = await db
    .select({ id: yearRoles.id })
    .from(yearRoles)
    .where(and(eq(yearRoles.year, entry.year), inArray(yearRoles.name, named)))
  if (roles.length === 0) return

  await db
    .insert(memberYearRoles)
    .values(
      roles.map((role) => ({ memberId, roleId: role.id, createdAt: now }))
    )
    .onConflictDoNothing()
}

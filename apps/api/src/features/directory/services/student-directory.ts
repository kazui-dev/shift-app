import { and, eq, sql } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

import {
  appUsers,
  bureaus,
  directoryDuties,
  duties,
  memberYearRoles,
  studentDirectory,
  yearMemberships,
  yearSettings,
} from "@workspace/db/schema"

type Db = DrizzleD1Database<Record<string, unknown>>

export type DirectoryEntry = {
  year: number
  studentId: string
  displayName: string
  /** The year roles the bureau and the duties carry, in no particular order. */
  roleIds: string[]
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

/**
 * The directory row for a student ID in a year, matched without case, with
 * every role the listing grants.
 */
export async function findDirectoryEntry(
  db: Db,
  year: number,
  studentId: string
): Promise<DirectoryEntry | null> {
  const [entry] = await db
    .select({
      id: studentDirectory.id,
      year: studentDirectory.year,
      studentId: studentDirectory.studentId,
      displayName: studentDirectory.displayName,
      bureauRoleId: bureaus.roleId,
    })
    .from(studentDirectory)
    .leftJoin(bureaus, eq(bureaus.id, studentDirectory.bureauId))
    .where(
      and(
        eq(studentDirectory.year, year),
        sql`lower(${studentDirectory.studentId}) = ${studentId.toLowerCase()}`
      )
    )
    .limit(1)
  if (!entry) return null

  const held = await db
    .select({ roleId: duties.roleId })
    .from(directoryDuties)
    .innerJoin(duties, eq(duties.id, directoryDuties.dutyId))
    .where(eq(directoryDuties.entryId, entry.id))

  const roleIds = [entry.bureauRoleId, ...held.map((duty) => duty.roleId)]
  return {
    year: entry.year,
    studentId: entry.studentId,
    displayName: entry.displayName,
    roleIds: roleIds.filter((id): id is string => id !== null),
  }
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
 * participation, and the roles their bureau and duties carry. Roles an
 * administrator added stay; nothing is revoked here.
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

  if (entry.roleIds.length === 0) return
  await db
    .insert(memberYearRoles)
    .values(
      entry.roleIds.map((roleId) => ({ memberId, roleId, createdAt: now }))
    )
    .onConflictDoNothing()
}

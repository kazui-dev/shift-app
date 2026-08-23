export type ActivityRow = {
  id: string
  year: number
  name: string
  place: string
  activityType: string
  startsAt: number
  endsAt: number
  color: string
  notes: string | null
  assignmentCount: number
}

export type AvailabilityManagerRow = {
  submissionId: string
  memberId: string
  displayName: string
  studentId: string
  status: "draft" | "submitted"
  submittedAt: number | null
  windowId: string | null
  date: string | null
  startsAt: number | null
  endsAt: number | null
}

const toIso = (timestamp: number) => new Date(timestamp).toISOString()

export function serializeActivity(activity: ActivityRow) {
  return {
    ...activity,
    startsAt: toIso(activity.startsAt),
    endsAt: toIso(activity.endsAt),
  }
}

export function groupAvailabilitySubmissions(rows: AvailabilityManagerRow[]) {
  const submissions = new Map<
    string,
    {
      id: string
      member: { id: string; displayName: string; studentId: string }
      status: "draft" | "submitted"
      submittedAt: string | null
      windows: Array<{
        id: string
        date: string
        startsAt: string
        endsAt: string
      }>
    }
  >()

  for (const row of rows) {
    const current = submissions.get(row.submissionId) ?? {
      id: row.submissionId,
      member: {
        id: row.memberId,
        displayName: row.displayName,
        studentId: row.studentId,
      },
      status: row.status,
      submittedAt: row.submittedAt === null ? null : toIso(row.submittedAt),
      windows: [],
    }
    if (
      row.windowId &&
      row.date &&
      row.startsAt !== null &&
      row.endsAt !== null
    ) {
      current.windows.push({
        id: row.windowId,
        date: row.date,
        startsAt: toIso(row.startsAt),
        endsAt: toIso(row.endsAt),
      })
    }
    submissions.set(row.submissionId, current)
  }

  return [...submissions.values()]
}

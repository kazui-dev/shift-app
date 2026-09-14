type Part = string | number | null | undefined

/** Call with no arguments for the prefix that matches every instance. */
const key =
  (...root: string[]) =>
  (...parts: Part[]) => [...root, ...parts]

export type CacheKey = ReturnType<typeof key>

export const keys = {
  account: key("account"),
  displayYear: key("display-year"),
  years: key("years"),
  roster: key("roster"),
  yearRoles: key("year-roles"),
  yearMemberships: key("year-memberships"),
  activities: key("activities"),
  activityEditor: key("activity-editor"),
  assignments: key("assignments"),
  assignmentMonth: key("assignments", "month"),
  availability: key("availability"),
  availabilityDates: key("availability-dates"),
  availabilitySubmissions: key("availability-submissions"),
  shiftAttendance: key("shift-attendance"),
  attendanceEvents: key("attendance-events"),
  chatRooms: key("chat-rooms"),
  chatRoom: key("chat-room"),
  chatMessages: key("chat-messages"),
  chatMembers: key("chat-members"),
  chatSettings: key("chat-settings"),
  chatTargets: key("chat-targets"),
  chatSearch: key("chat-search"),
  chatImageMessage: key("chat-image-message"),
  admin: key("admin"),
  adminUsers: key("admin", "users"),
  adminAuditLogs: key("admin", "audit-logs"),
  adminLinkRequests: key("admin", "discord-link-requests"),
} as const

export function keyRoot(cacheKey: CacheKey): string {
  return String(cacheKey()[0])
}

/** Cached per room, so one room's data is dropped or refreshed together. */
export const roomKeys = [
  keys.chatRoom,
  keys.chatMessages,
  keys.chatMembers,
  keys.chatSettings,
  keys.chatSearch,
  keys.chatImageMessage,
]

/** Visibility and permissions follow membership, so these outlive no change. */
export const membershipKeys = [
  keys.years,
  keys.displayYear,
  keys.roster,
  keys.yearRoles,
  keys.yearMemberships,
  keys.activities,
  keys.activityEditor,
  keys.assignments,
  keys.chatRooms,
  keys.chatRoom,
  keys.chatSettings,
  keys.chatTargets,
  keys.chatMembers,
  keys.admin,
  keys.shiftAttendance,
]

/** Reading context kept across launches, with how many entries survive. */
export const persistedKeys = new Map<CacheKey, number>([
  [keys.assignments, 6],
  [keys.chatRooms, 6],
  [keys.chatRoom, 20],
  [keys.chatMessages, 20],
  [keys.displayYear, 1],
])

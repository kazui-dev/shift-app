import { ApiError } from "@/api/client"
type Entry = {
  at: string
  stage: string
  activation: boolean
  permission: NotificationPermission
  error?: string
  status?: number
  code?: string
}
const entries: Entry[] = []
export function recordPushStep(stage: string, error?: unknown) {
  const entry: Entry = {
    at: new Date().toISOString(),
    stage,
    activation: navigator.userActivation?.isActive ?? false,
    permission: Notification.permission,
    ...(error instanceof ApiError
      ? { status: error.status, code: error.code }
      : {}),
    ...(error
      ? { error: error instanceof Error ? error.name : "UnknownError" }
      : {}),
  }
  entries.push(entry)
  if (entries.length > 30) entries.shift()
  console.debug("[push]", entry)
}
export function pushDiagnosticText(): string {
  return JSON.stringify(entries, null, 2)
}

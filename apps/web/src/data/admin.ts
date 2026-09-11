import { queryOptions } from "@tanstack/react-query"
import {
  getAdminUsers,
  getAdminAuditLogs,
  getDiscordLinkRequests,
} from "@/api/admin"
export const usersQuery = queryOptions({
  queryKey: ["admin", "users"],
  queryFn: getAdminUsers,
  staleTime: 60_000,
})
export const auditQuery = queryOptions({
  queryKey: ["admin", "audit-logs"],
  queryFn: getAdminAuditLogs,
  staleTime: 15_000,
})
export const linksQuery = queryOptions({
  queryKey: ["admin", "discord-link-requests"],
  queryFn: getDiscordLinkRequests,
  staleTime: 30_000,
})

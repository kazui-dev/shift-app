import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import {
  getAdminUsers,
  getAdminAuditLogs,
  getDiscordLinkRequests,
} from "@/features/admin/api/admin"
export const usersQuery = queryOptions({
  queryKey: keys.adminUsers(),
  queryFn: getAdminUsers,
  staleTime: 60_000,
})
export const auditQuery = queryOptions({
  queryKey: keys.adminAuditLogs(),
  queryFn: getAdminAuditLogs,
  staleTime: 15_000,
})
export const linksQuery = queryOptions({
  queryKey: keys.adminLinkRequests(),
  queryFn: getDiscordLinkRequests,
  staleTime: 30_000,
})

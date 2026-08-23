import { useQuery } from "@tanstack/react-query"

import { getAdminAuditLogs, getDiscordLinkRequests } from "@/api/admin"
import { AuditLogList } from "@/components/admin/audit-log-list"
import { DiscordLinkRequestCard } from "@/components/admin/discord-link-request-card"
import { EmptyState } from "@/components/page-layout"

export function DiscordLinkRequestManager() {
  const requests = useQuery({
    queryKey: ["admin", "discord-link-requests"],
    queryFn: getDiscordLinkRequests,
    meta: { persist: false },
  })
  if (requests.isPending) return null
  if (requests.isError)
    return (
      <p className="text-sm text-destructive">
        Discord連携申請を読み込めませんでした。
      </p>
    )
  if (requests.data.requests.length === 0)
    return <EmptyState>申請はありません</EmptyState>
  return (
    <ul className="divide-y border-y">
      {requests.data.requests.map((request) => (
        <DiscordLinkRequestCard key={request.id} request={request} />
      ))}
    </ul>
  )
}

export function AuditLogManager() {
  const logs = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: getAdminAuditLogs,
    meta: { persist: false },
  })
  if (logs.isPending) return null
  if (logs.isError)
    return (
      <p className="text-sm text-destructive">
        操作履歴を読み込めませんでした。
      </p>
    )
  return <AuditLogList logs={logs.data.auditLogs} />
}

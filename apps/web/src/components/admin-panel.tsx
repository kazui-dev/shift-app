import { linksQuery, auditQuery } from "@/data/admin"
import { useQuery } from "@tanstack/react-query"

import { AuditLogList } from "@/components/admin/audit-log-list"
import { DiscordLinkRequestCard } from "@/components/admin/discord-link-request-card"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@/components/page-layout"

export function DiscordLinkRequestManager() {
  const requests = useQuery({
    ...linksQuery,
    meta: { persist: false },
  })
  if (requests.isPending) return <EmptyState>読み込み中…</EmptyState>
  if (requests.isError)
    return (
      <div role="alert">
        申請を読み込めませんでした。
        <Button variant="ghost" onClick={() => void requests.refetch()}>
          再読み込み
        </Button>
      </div>
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
    ...auditQuery,
    meta: { persist: false },
  })
  if (logs.isPending) return <EmptyState>読み込み中…</EmptyState>
  if (logs.isError)
    return (
      <div role="alert">
        操作履歴を読み込めませんでした。
        <Button variant="ghost" onClick={() => void logs.refetch()}>
          再読み込み
        </Button>
      </div>
    )
  if (logs.data.auditLogs.length === 0)
    return <EmptyState>操作履歴はありません</EmptyState>
  return <AuditLogList logs={logs.data.auditLogs} />
}

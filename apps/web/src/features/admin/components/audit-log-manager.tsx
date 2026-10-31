import { auditQuery } from "@/features/admin/data/admin"
import { useQuery } from "@tanstack/react-query"

import { AuditLogList } from "@/features/admin/components/audit-log-list"
import { QueryError } from "@/components/query-error"
import { EmptyState } from "@/app/page-layout"

export function AuditLogManager() {
  const logs = useQuery({
    ...auditQuery,
    meta: { persist: false },
  })
  if (logs.isPending) return <EmptyState>読み込み中…</EmptyState>
  if (logs.isError)
    return (
      <QueryError
        message="操作履歴を読み込めませんでした。"
        onRetry={() => logs.refetch()}
      />
    )
  if (logs.data.auditLogs.length === 0)
    return <EmptyState>操作履歴はありません</EmptyState>
  return <AuditLogList logs={logs.data.auditLogs} />
}

import { useQuery } from "@tanstack/react-query"

import {
  getAdminAuditLogs,
  getAdminMembers,
  getRecoveryRequests,
} from "@/api/admin"
import { AuditLogList } from "@/components/admin/audit-log-list"
import { AdminMemberCard } from "@/components/admin/member-card"
import { RecoveryRequestCard } from "@/components/admin/recovery-request-card"
import { EmptyState, LoadingState } from "@/components/page-layout"

export function AccountManager() {
  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: getAdminMembers,
    meta: { persist: false },
  })
  if (members.isPending) return <LoadingState />
  if (members.isError)
    return (
      <p className="text-sm text-destructive">
        アカウントを読み込めませんでした。
      </p>
    )
  return (
    <ul className="divide-y border-y">
      {members.data.members.map((member) => (
        <AdminMemberCard key={member.id} member={member} />
      ))}
    </ul>
  )
}

export function RecoveryRequestManager() {
  const requests = useQuery({
    queryKey: ["admin", "recovery-requests"],
    queryFn: getRecoveryRequests,
    meta: { persist: false },
  })
  if (requests.isPending) return <LoadingState />
  if (requests.isError)
    return (
      <p className="text-sm text-destructive">
        連携申請を読み込めませんでした。
      </p>
    )
  if (requests.data.requests.length === 0)
    return <EmptyState>申請はありません</EmptyState>
  return (
    <ul className="divide-y border-y">
      {requests.data.requests.map((request) => (
        <RecoveryRequestCard key={request.id} request={request} />
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
  if (logs.isPending) return <LoadingState />
  if (logs.isError)
    return (
      <p className="text-sm text-destructive">
        操作履歴を読み込めませんでした。
      </p>
    )
  return <AuditLogList logs={logs.data.auditLogs} />
}

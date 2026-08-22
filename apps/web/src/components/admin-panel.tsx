import { useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import {
  getAdminAuditLogs,
  getAdminMembers,
  getRecoveryRequests,
} from "@/api/admin"
import { AuditLogList } from "@/components/admin/audit-log-list"
import { AdminMemberCard } from "@/components/admin/member-card"
import { RecoveryRequestCard } from "@/components/admin/recovery-request-card"
import { EmptyState, LoadingState } from "@/components/page-layout"

export function AdminPanel() {
  const queryClient = useQueryClient()
  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: getAdminMembers,
    meta: { persist: false },
  })
  const linkRequests = useQuery({
    queryKey: ["admin", "recovery-requests"],
    queryFn: getRecoveryRequests,
    meta: { persist: false },
  })
  const auditLogs = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: getAdminAuditLogs,
    meta: { persist: false },
  })

  const isPending =
    members.isPending || linkRequests.isPending || auditLogs.isPending
  const isError = members.isError || linkRequests.isError || auditLogs.isError

  return (
    <section className="space-y-6 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">アカウント管理</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin"] })}
        >
          <RefreshCw />
          <span className="sr-only">再読み込み</span>
        </Button>
      </div>

      {isPending && <LoadingState />}
      {isError && (
        <p className="text-sm text-destructive">
          管理情報を読み込めませんでした。再読み込みしてください。
        </p>
      )}

      {members.data && (
        <div className="space-y-3">
          <h3 className="font-medium">メンバー</h3>
          <ul className="divide-y border-y">
            {members.data.members.map((member) => (
              <AdminMemberCard key={member.id} member={member} />
            ))}
          </ul>
        </div>
      )}

      {linkRequests.data && (
        <div className="space-y-3">
          <h3 className="font-medium">
            アカウント連携申請
            <span className="ml-2 text-xs text-muted-foreground">
              {linkRequests.data.requests.length}件
            </span>
          </h3>
          {linkRequests.data.requests.length === 0 ? (
            <EmptyState>申請はありません</EmptyState>
          ) : (
            <ul className="divide-y border-y">
              {linkRequests.data.requests.map((request) => (
                <RecoveryRequestCard key={request.id} request={request} />
              ))}
            </ul>
          )}
        </div>
      )}

      {auditLogs.data && <AuditLogList logs={auditLogs.data.auditLogs} />}
    </section>
  )
}

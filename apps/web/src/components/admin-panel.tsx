import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import {
  getAdminAuditLogs,
  getAdminMembers,
  getRecoveryRequests,
} from "@/api/admin"
import { AuditLogList } from "@/components/admin/audit-log-list"
import { AdminMemberCard } from "@/components/admin/member-card"
import { RecoveryRequestCard } from "@/components/admin/recovery-request-card"

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
    <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            <h2 className="text-lg font-medium">システム管理</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            権限・セッション・アカウント復旧の操作は監査ログに残ります。
          </p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin"] })}
        >
          <RefreshCw />
          <span className="sr-only">再読み込み</span>
        </Button>
      </div>

      {isPending && (
        <LoaderCircle className="animate-spin text-muted-foreground" />
      )}
      {isError && (
        <p className="text-sm text-destructive">
          管理情報を読み込めませんでした。再読み込みしてください。
        </p>
      )}

      {members.data && (
        <div className="space-y-3">
          <h3 className="font-medium">メンバー</h3>
          <ul className="space-y-3">
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
            <p className="text-sm text-muted-foreground">申請はありません。</p>
          ) : (
            <ul className="space-y-3">
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

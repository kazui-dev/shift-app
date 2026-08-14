import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react"

import {
  adminAuditLogsResponseSchema,
  adminMembersResponseSchema,
  adminMutationResponseSchema,
  identityLinkRequestsResponseSchema,
  revokeSessionsResponseSchema,
  type AdminAuditLog,
  type AdminMember,
  type IdentityLinkRequest,
} from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

const accessLevelLabels = {
  system_admin: "システム管理者",
  leader: "委員会幹部",
  member: "メンバー",
} as const

async function getAdminMembers() {
  const response = await fetch("/api/admin/members", { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Members API returned ${response.status}`)
  }
  return adminMembersResponseSchema.parse(await response.json())
}

async function getIdentityLinkRequests() {
  const response = await fetch("/api/admin/identity-link-requests", {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Identity link API returned ${response.status}`)
  }
  return identityLinkRequestsResponseSchema.parse(await response.json())
}

async function getAuditLogs() {
  const response = await fetch("/api/admin/audit-logs", { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Audit API returned ${response.status}`)
  }
  return adminAuditLogsResponseSchema.parse(await response.json())
}

async function readError(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json()
    if (
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "string"
    ) {
      return value.error
    }
  } catch {
    // Fall back to a status-based message.
  }
  return `操作に失敗しました（${response.status}）`
}

function MemberCard({ member }: { member: AdminMember }) {
  const queryClient = useQueryClient()
  const [accessLevel, setAccessLevel] = useState(member.accessLevel)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState<"role" | "sessions" | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshAdminData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
    ])
  }

  async function updateRole() {
    setPending("role")
    setMessage(null)
    const response = await fetch(
      `/api/admin/members/${encodeURIComponent(member.id)}/access-level`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessLevel, reason }),
      }
    )

    if (!response.ok) {
      setMessage(await readError(response))
      setPending(null)
      return
    }

    adminMutationResponseSchema.parse(await response.json())
    setReason("")
    setMessage("権限を更新しました。")
    await refreshAdminData()
    setPending(null)
  }

  async function revokeSessions() {
    if (!reason.trim()) {
      setMessage("操作理由を入力してください。")
      return
    }
    if (
      !window.confirm(
        member.isCurrentUser
          ? "自分を含む全端末からログアウトします。続けますか？"
          : `${member.displayName}さんの全セッションを失効します。続けますか？`
      )
    ) {
      return
    }

    setPending("sessions")
    setMessage(null)
    const response = await fetch(
      `/api/admin/members/${encodeURIComponent(member.id)}/revoke-sessions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }
    )

    if (!response.ok) {
      setMessage(await readError(response))
      setPending(null)
      return
    }

    const result = revokeSessionsResponseSchema.parse(await response.json())
    setReason("")
    setMessage(`${result.revokedSessions}件のセッションを失効しました。`)

    if (member.isCurrentUser) {
      queryClient.removeQueries({ queryKey: ["auth-state"] })
      await queryClient.invalidateQueries({ queryKey: ["auth-state"] })
      return
    }

    await refreshAdminData()
    setPending(null)
  }

  const roleIsUnchanged = accessLevel === member.accessLevel

  return (
    <li className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {member.displayName}
            {member.isCurrentUser && (
              <span className="ml-2 text-xs text-muted-foreground">自分</span>
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {member.studentId}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          セッション {member.sessionCount}件
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">権限</span>
          <select
            className="h-10 rounded-md border bg-background px-3 disabled:opacity-60"
            disabled={member.isCurrentUser || pending !== null}
            value={accessLevel}
            onChange={(event) =>
              setAccessLevel(event.target.value as AdminMember["accessLevel"])
            }
          >
            {Object.entries(accessLevelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">操作理由</span>
          <input
            className="h-10 rounded-md border bg-background px-3"
            disabled={pending !== null}
            maxLength={240}
            placeholder="例: 委員会幹部への就任"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={
            member.isCurrentUser ||
            roleIsUnchanged ||
            !reason.trim() ||
            pending !== null
          }
          onClick={updateRole}
        >
          {pending === "role" && <LoaderCircle className="animate-spin" />}
          権限を保存
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!reason.trim() || pending !== null}
          onClick={revokeSessions}
        >
          {pending === "sessions" && <LoaderCircle className="animate-spin" />}
          全セッションを失効
        </Button>
      </div>

      {member.isCurrentUser && (
        <p className="text-xs text-muted-foreground">
          管理者自身の権限はこの画面から変更できません。
        </p>
      )}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </li>
  )
}

function IdentityLinkRequestCard({
  request,
}: {
  request: IdentityLinkRequest
}) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: "approved" | "rejected") {
    if (!reason.trim()) {
      setError("判断理由を入力してください。")
      return
    }
    if (
      decision === "approved" &&
      !window.confirm(
        "既存のDiscord連携を置き換え、関係する全セッションを失効します。本人確認済みの場合だけ続行してください。"
      )
    ) {
      return
    }

    setPending(decision)
    setError(null)
    const response = await fetch(
      `/api/admin/identity-link-requests/${encodeURIComponent(request.id)}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      }
    )

    if (!response.ok) {
      setError(await readError(response))
      setPending(null)
      return
    }

    adminMutationResponseSchema.parse(await response.json())
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin", "identity-link-requests"],
      }),
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
    ])
    setPending(null)
  }

  return (
    <li className="space-y-3 rounded-lg border bg-background p-4">
      <div>
        <p>
          <span className="font-medium">{request.requesterDisplayName}</span>
          からの連携申請
        </p>
        <p className="text-xs text-muted-foreground">
          対象: {request.targetDisplayName}（{request.targetStudentId}）
        </p>
      </div>
      <input
        className="h-10 w-full rounded-md border bg-background px-3"
        maxLength={240}
        placeholder="本人確認の方法、または拒否理由"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={
            request.targetsCurrentAdmin || !reason.trim() || pending !== null
          }
          onClick={() => decide("approved")}
        >
          {pending === "approved" && <LoaderCircle className="animate-spin" />}
          承認
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!reason.trim() || pending !== null}
          onClick={() => decide("rejected")}
        >
          {pending === "rejected" && <LoaderCircle className="animate-spin" />}
          拒否
        </Button>
      </div>
      {request.targetsCurrentAdmin && (
        <p className="text-xs text-destructive">
          自分のidentity
          recoveryは別の管理者またはCloudflare運用者による確認が必要です。
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  )
}

function auditSummary(log: AdminAuditLog): string {
  const actor =
    log.actorDisplayName ??
    (log.actorType === "cloudflare_operator"
      ? "Cloudflare運用者"
      : "削除済み管理者")
  const target = log.targetDisplayName ?? "対象なし"
  return `${actor} → ${target}`
}

export function AdminPanel() {
  const queryClient = useQueryClient()
  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: getAdminMembers,
    meta: { persist: false },
  })
  const linkRequests = useQuery({
    queryKey: ["admin", "identity-link-requests"],
    queryFn: getIdentityLinkRequests,
    meta: { persist: false },
  })
  const auditLogs = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: getAuditLogs,
    meta: { persist: false },
  })

  const isPending =
    members.isPending || linkRequests.isPending || auditLogs.isPending
  const isError = members.isError || linkRequests.isError || auditLogs.isError

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: ["admin"] })
  }

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
        <Button size="icon-sm" variant="ghost" onClick={refreshAll}>
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
              <MemberCard key={member.id} member={member} />
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
                <IdentityLinkRequestCard key={request.id} request={request} />
              ))}
            </ul>
          )}
        </div>
      )}

      {auditLogs.data && (
        <div className="space-y-3">
          <h3 className="font-medium">監査ログ</h3>
          <ol className="divide-y rounded-lg border bg-background px-4">
            {auditLogs.data.auditLogs.map((log) => {
              const reason =
                typeof log.details?.reason === "string"
                  ? log.details.reason
                  : null
              return (
                <li key={log.id} className="space-y-1 py-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono">{log.action}</span>
                    <time className="text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("ja-JP")}
                    </time>
                  </div>
                  <p>{auditSummary(log)}</p>
                  {reason && (
                    <p className="text-muted-foreground">理由: {reason}</p>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}

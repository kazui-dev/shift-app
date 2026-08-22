import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import type { AdminMember } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { revokeAdminSessions, updateAdminAccessLevel } from "@/api/admin"
import { errorMessage } from "@/api/client"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"

const accessLevelLabels = {
  system_admin: "システム管理者",
  leader: "委員会幹部",
  member: "メンバー",
} as const

function isAccessLevel(value: string): value is AdminMember["accessLevel"] {
  return value === "system_admin" || value === "leader" || value === "member"
}

export function AdminMemberCard({ member }: { member: AdminMember }) {
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
    try {
      await updateAdminAccessLevel(member.id, { accessLevel, reason })
      setReason("")
      setMessage("権限を更新しました。")
      await refreshAdminData()
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
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
    try {
      const result = await revokeAdminSessions(member.id, reason)
      setReason("")
      setMessage(`${result.revokedSessions}件のセッションを失効しました。`)

      if (member.isCurrentUser) {
        queryClient.removeQueries({ queryKey: ["admin"] })
        queryClient.removeQueries({ queryKey: ["account"] })
        await queryClient.invalidateQueries({ queryKey: ["account"] })
        return
      }

      await refreshAdminData()
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  const roleIsUnchanged = accessLevel === member.accessLevel

  return (
    <li className="space-y-3 py-4">
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
            className={`${fieldClassName} disabled:opacity-60`}
            disabled={member.isCurrentUser || pending !== null}
            value={accessLevel}
            onChange={(event) => {
              if (isAccessLevel(event.target.value)) {
                setAccessLevel(event.target.value)
              }
            }}
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
            className={fieldClassName}
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
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </li>
  )
}

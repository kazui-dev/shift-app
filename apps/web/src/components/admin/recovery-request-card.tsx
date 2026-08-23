import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import type { IdentityLinkRequest } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { decideRecoveryRequest } from "@/api/admin"
import { errorMessage } from "@/api/client"
import { FeedbackNotice } from "@/components/feedback-notice"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { fieldClassName } from "@/components/form-styles"

export function RecoveryRequestCard({
  request,
}: {
  request: IdentityLinkRequest
}) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmApproval, setConfirmApproval] = useState(false)

  async function decide(decision: "approved" | "rejected") {
    if (!reason.trim()) {
      setError("判断理由を入力してください。")
      return
    }
    setPending(decision)
    setError(null)
    try {
      await decideRecoveryRequest(request.id, { decision, reason })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "recovery-requests"],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin", "members"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
      ])
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(null)
    }
  }

  return (
    <li className="space-y-3 py-4">
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
        className={fieldClassName}
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
          onClick={() => setConfirmApproval(true)}
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
          自分のアカウント連携は、別の管理者による確認が必要です。
        </p>
      )}
      {error && (
        <FeedbackNotice
          message={error}
          tone="error"
          onDismiss={() => setError(null)}
        />
      )}
      {confirmApproval && (
        <ConfirmDialog
          title="連携先を置き換えますか"
          description="既存のDiscord連携を置き換えます。本人確認済みの場合だけ続けてください。"
          confirmLabel="承認する"
          onCancel={() => setConfirmApproval(false)}
          onConfirm={() => {
            setConfirmApproval(false)
            void decide("approved")
          }}
        />
      )}
    </li>
  )
}

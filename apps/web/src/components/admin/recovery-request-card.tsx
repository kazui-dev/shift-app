import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import type { IdentityLinkRequest } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { decideRecoveryRequest } from "@/api/admin"
import { errorMessage } from "@/api/client"

export function RecoveryRequestCard({
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

import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import {
  activateYearMembership,
  deactivateYearMembership,
  getYearMemberships,
} from "@/api/years"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"

export function YearMembershipManager({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const memberships = useQuery({
    queryKey: ["year-memberships", year],
    queryFn: () => getYearMemberships(year),
  })
  const [participantId, setParticipantId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshMemberships() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["year-memberships", year] }),
      queryClient.invalidateQueries({ queryKey: ["roster", year] }),
    ])
  }

  async function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!participantId) return
    setPending(true)
    setMessage(null)
    try {
      await activateYearMembership(year, participantId)
      setParticipantId("")
      await refreshMemberships()
      setMessage("年度参加者を追加しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function removeParticipant(memberId: string) {
    if (
      !window.confirm(
        "この年度へのアクセスと実効権限を停止します。過去データとロール割当は保持されます。続けますか？"
      )
    )
      return
    setPending(true)
    setMessage(null)
    try {
      await deactivateYearMembership(year, memberId)
      await refreshMemberships()
      setMessage("年度参加を無効化しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-4 border-t pt-5">
      <div>
        <h3 className="font-medium">年度参加者</h3>
        <p className="text-sm text-muted-foreground">
          この年度を利用できるメンバーを設定します。
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={addParticipant}
      >
        <select
          className={`${fieldClassName} min-w-0 flex-1`}
          required
          value={participantId}
          onChange={(event) => setParticipantId(event.target.value)}
        >
          <option value="">追加するメンバー</option>
          {memberships.data?.memberships
            .filter((membership) => membership.status !== "active")
            .map((membership) => (
              <option key={membership.member.id} value={membership.member.id}>
                {membership.member.displayName}（{membership.member.studentId}）
              </option>
            ))}
        </select>
        <Button disabled={pending}>追加</Button>
      </form>
      <ul className="space-y-2 text-sm">
        {memberships.data?.memberships
          .filter((membership) => membership.status === "active")
          .map((membership) => (
            <li
              key={membership.member.id}
              className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
            >
              <span>
                {membership.member.displayName}（{membership.member.studentId}）
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void removeParticipant(membership.member.id)}
              >
                無効化
              </Button>
            </li>
          ))}
      </ul>
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </section>
  )
}

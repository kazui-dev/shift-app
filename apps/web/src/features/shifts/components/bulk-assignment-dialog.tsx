import { useId, useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  japanDateTime,
  japanInputValue,
  japanLocalDateTime,
  japanTime,
} from "@workspace/shared/japan-time"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { SelectField } from "@/components/select-field"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import type { EditorData } from "../editor-data"
import {
  assignMembers,
  reviewAssignments,
  type AssignmentWindow,
} from "./bulk-assignment"

export function BulkAssignmentDialog({
  data,
  plan,
  onApply,
  onClose,
}: {
  data: EditorData
  plan: ActivityEditorInput
  onApply: (
    plan: ActivityEditorInput,
    acknowledged: EditorData["availability"]
  ) => void
  onClose: () => void
}) {
  const fieldId = useId()
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState(japanInputValue(plan.startsAt).slice(11, 16))
  const [to, setTo] = useState(japanInputValue(plan.endsAt).slice(11, 16))
  const [review, setReview] = useState<AssignmentWindow | null>(null)
  const [excluded, setExcluded] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const rows = review ? reviewAssignments(data, plan, selected, review) : []
  const included = rows.filter(
    (row) => !row.blocked && !excluded.includes(row.memberId)
  )
  const term = search.trim().toLocaleLowerCase()
  const members = data.members.filter((member) =>
    `${member.displayName} ${member.studentId}`
      .toLocaleLowerCase()
      .includes(term)
  )
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    )
  }
  function confirm() {
    const start = japanLocalDateTime(
      `${japanDateTime(plan.startsAt).date}T${from}`
    )
    const end = japanLocalDateTime(`${japanDateTime(plan.endsAt).date}T${to}`)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      setError("終了は開始より後にしてください。")
      return
    }
    if (start < Date.parse(plan.startsAt) || end > Date.parse(plan.endsAt)) {
      setError("シフトの開始・終了の範囲内で指定してください。")
      return
    }
    setError(null)
    setExcluded([])
    setReview({
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    })
  }
  return (
    <ResponsiveDialog
      open
      title="一括割当"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="md:max-w-xl"
      bodyClassName="flex min-h-0 flex-col gap-4 py-4"
    >
      {review ? (
        <>
          <p className="text-sm tabular-nums">
            {japanTime(review.startsAt)}〜{japanTime(review.endsAt)} ·{" "}
            {included.length}人
          </p>
          <p className="text-xs text-muted-foreground">
            未回答・参加不可・希望時間外も、チェックを残すと割り当てます。勤務が重なる人と割当済みの人は除外します。
          </p>
          <div className="max-h-[40dvh] divide-y overflow-y-auto">
            {rows.map((row) => (
              <label
                key={row.memberId}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  aria-label={`${row.name}に割り当てる`}
                  disabled={row.blocked}
                  checked={!row.blocked && !excluded.includes(row.memberId)}
                  onChange={(event) =>
                    setExcluded((current) =>
                      event.target.checked
                        ? current.filter((id) => id !== row.memberId)
                        : [...current, row.memberId]
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                {row.reason && (
                  <span className="text-xs text-muted-foreground">
                    {row.reason}
                  </span>
                )}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReview(null)
                setError(null)
              }}
            >
              戻る
            </Button>
            <Button
              variant="outline"
              disabled={!included.length}
              onClick={() => {
                const result = assignMembers(
                  data,
                  plan,
                  included.map((row) => row.memberId),
                  review
                )
                if ("error" in result) {
                  setError(result.error)
                  return
                }
                onApply(
                  result.plan,
                  included.map((row) => ({ memberId: row.memberId, ...review }))
                )
                onClose()
              }}
            >
              {included.length}人に適用
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <label
              htmlFor={`${fieldId}-start`}
              className="flex-1 text-xs text-muted-foreground"
            >
              開始
              <Input
                className="mt-2"
                id={`${fieldId}-start`}
                aria-label="一括割当の開始"
                type="time"
                step={60}
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <span className="pb-2">〜</span>
            <label
              htmlFor={`${fieldId}-end`}
              className="flex-1 text-xs text-muted-foreground"
            >
              終了
              <Input
                className="mt-2"
                id={`${fieldId}-end`}
                aria-label="一括割当の終了"
                type="time"
                step={60}
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelected(data.members.map((member) => member.id))
              }
            >
              全メンバー
            </Button>
            <SelectField
              aria-label="選択するロール"
              value=""
              className="min-w-36 flex-1"
              options={[
                { value: "", label: "ロールを追加" },
                ...data.roles.map((role) => ({
                  value: role.id,
                  label: role.name,
                })),
              ]}
              onValueChange={(role) =>
                setSelected((current) => [
                  ...new Set([
                    ...current,
                    ...data.members
                      .filter((member) =>
                        member.roles.some((item) => item.id === role)
                      )
                      .map((member) => member.id),
                  ]),
                ])
              }
            />
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              選択解除
            </Button>
          </div>
          <Input
            aria-label="割当メンバーを検索"
            placeholder="名前・学籍番号で検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="grid max-h-[35dvh] grid-cols-2 gap-1 overflow-y-auto">
            {members.map((member) => (
              <button
                type="button"
                key={member.id}
                aria-pressed={selected.includes(member.id)}
                aria-label={`${member.displayName}を選択`}
                onClick={() => toggle(member.id)}
                className="flex min-w-0 items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="relative shrink-0">
                  <MemberAvatar
                    name={member.displayName}
                    image={member.image}
                    className="size-8 text-xs"
                  />
                  {selected.includes(member.id) && (
                    <span className="absolute -right-1 -bottom-1 rounded-full bg-primary p-0.5 text-primary-foreground ring-2 ring-background">
                      <Check className="size-3" />
                    </span>
                  )}
                </span>
                <span className="truncate">{member.displayName}</span>
              </button>
            ))}
            {!members.length && (
              <p className="col-span-2 py-4 text-sm text-muted-foreground">
                条件に合うメンバーがいません。
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm tabular-nums">
              {selected.length}人選択
            </span>
            <Button
              variant="outline"
              disabled={!selected.length}
              onClick={confirm}
            >
              確認
            </Button>
          </div>
        </>
      )}
    </ResponsiveDialog>
  )
}

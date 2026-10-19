import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { ShiftTimeDialog } from "./shift-time-dialog"
import { X } from "lucide-react"
import { overviewAttendance } from "./overview-model"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SelectField } from "@/components/select-field"
import { keys } from "@/app/data/keys"
import { ApiError, errorMessage } from "@/lib/http/client"
import {
  japanInputValue,
  japanDateTime,
  japanLocalDateTime,
} from "@workspace/shared/japan-time"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { activityQuery } from "../data/activities"
import { saveActivity } from "../api/activities"
import { planOf } from "./use-shift-plan"
import { assignMember } from "./assign-member"
import { useManagement } from "@/features/management/management-context"
import type { OverviewSelection } from "./overview-model"

export function OverviewEditor({
  selection,
  data,
  onClose,
}: {
  selection: OverviewSelection
  data: ShiftOverview
  onClose: () => void
}) {
  const client = useQueryClient()
  const { setDirty } = useManagement()
  const [activityId, setActivityId] = useState(selection.activityId)
  const [from, setFrom] = useState(japanInputValue(selection.startsAt))
  const [to, setTo] = useState(japanInputValue(selection.endsAt))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const [confirm, setConfirm] = useState<"save" | "remove" | null>(null)
  const query = useQuery({
    ...activityQuery(activityId),
    enabled: !!activityId,
    staleTime: 0,
    refetchOnMount: "always",
  })
  useEffect(() => {
    setDirty(true)
    return () => setDirty(false)
  }, [setDirty])
  const sameDay =
    japanDateTime(selection.startsAt).date ===
    japanDateTime(selection.endsAt).date
  const assignment = data.assignments.find(
    (a) => a.slotId === selection.slotId && a.memberId === selection.memberId
  )
  const member = data.members.find((m) => m.id === selection.memberId)
  async function save(remove = false, confirmed = false) {
    const source = query.data
    if (!source || query.isFetching || query.isError || conflict || pending)
      return
    const start = japanLocalDateTime(from),
      end = japanLocalDateTime(to)
    if (
      !remove &&
      (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
    ) {
      setError("開始・終了日時を確認してください。")
      return
    }
    const original = source.slots.find(
      (s) =>
        s.id === selection.slotId && s.memberIds.includes(selection.memberId)
    )
    if (selection.slotId && !original) {
      setError("この勤務は変更または解除されています。一覧を更新してください。")
      return
    }
    let plan = planOf(source)
    if (remove) {
      if (!confirmed) {
        setConfirm("remove")
        return
      }
      plan = {
        ...plan,
        slots: plan.slots.map((s) =>
          s.id === selection.slotId
            ? {
                ...s,
                memberIds: s.memberIds.filter(
                  (id) => id !== selection.memberId
                ),
              }
            : s
        ),
      }
    } else {
      const value = {
        ...selection,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
      }
      const assigned = assignMember(plan, value, source.otherAssignments)
      if ("error" in assigned) {
        setError(assigned.error)
        return
      }
      if (
        !confirmed &&
        !source.availability.some(
          (w) =>
            w.memberId === selection.memberId &&
            Date.parse(w.startsAt) <= start &&
            Date.parse(w.endsAt) >= end
        )
      ) {
        setConfirm("save")
        return
      }
      plan = { ...plan, slots: assigned.slots }
    }
    setConfirm(null)
    setPending(true)
    setError("")
    try {
      const saved = await saveActivity(activityId, plan)
      client.setQueryData(keys.activityEditor(activityId), saved)
      await Promise.all(
        [
          keys.shiftOverview(),
          keys.activities(),
          keys.assignments(),
          keys.shiftAttendance(activityId),
          keys.chatRooms(),
        ].map((queryKey) => client.invalidateQueries({ queryKey }))
      )
      toast.success(remove ? "割当を解除しました。" : "保存しました。")
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setConflict(e instanceof ApiError && e.code === "SHIFT_CHANGED")
    } finally {
      setPending(false)
    }
  }
  if (confirm)
    return (
      <ConfirmDialog
        title={
          confirm === "remove"
            ? "この勤務の割当を解除しますか"
            : "希望時間外の勤務を保存しますか"
        }
        confirmLabel={confirm === "remove" ? "解除する" : "保存する"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void save(confirm === "remove", true)}
      />
    )

  return (
    <ShiftTimeDialog
      titleId="overview-time-title"
      onClose={() => {
        if (!pending) onClose()
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 id="overview-time-title" className="text-sm font-semibold">
            {member?.displayName}{" "}
            <span className="font-normal text-muted-foreground">
              勤務を編集
            </span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {member?.studentId} / {member?.roles.map((r) => r.name).join("・")}
          </p>
          {assignment && (
            <p className="mt-1 text-xs text-muted-foreground">
              {overviewAttendance(assignment)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="勤務時間の編集を閉じる"
          disabled={pending}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="space-y-4">
        <div className="block space-y-2 text-sm">
          シフト
          <SelectField
            aria-label="追加するシフト"
            value={activityId}
            disabled={!!selection.slotId || pending}
            options={[
              { value: "", label: "シフトを選択" },
              ...data.activities.map((a) => ({
                value: a.id,
                label: `${a.name}${a.active ? "" : "（無効）"}`,
              })),
            ]}
            onValueChange={(id) => {
              setActivityId(id)
              setError("")
            }}
          />
        </div>
        {query.isFetching && (
          <p className="text-sm text-muted-foreground">勤務を確認しています…</p>
        )}
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            読み込めませんでした。
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              再試行
            </Button>
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          {[
            { label: "開始", value: from, set: setFrom },
            { label: "終了", value: to, set: setTo },
          ].map((field) => (
            <label
              key={field.label}
              className="space-y-2 text-xs text-muted-foreground"
            >
              {field.label}
              <Input
                aria-label={`勤務の${field.label}`}
                type={sameDay ? "time" : "datetime-local"}
                controlSize="lg"
                className="mt-2 text-base text-foreground"
                step={60}
                value={sameDay ? field.value.slice(11) : field.value}
                disabled={pending}
                onChange={(e) =>
                  field.set(
                    sameDay
                      ? `${field.value.slice(0, 10)}T${e.target.value}`
                      : e.target.value
                  )
                }
              />
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {conflict && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void query.refetch().then((result) => {
                if (result.isSuccess) {
                  setConflict(false)
                  setError(
                    "最新の勤務を取得しました。時間を確認して再度保存してください。"
                  )
                }
              })
            }
          >
            最新の勤務を確認
          </Button>
        )}
        <div className="flex justify-between gap-2">
          {selection.slotId && (
            <Button
              variant="outline"
              size="sm"
              disabled={
                pending ||
                query.isFetching ||
                query.isError ||
                conflict ||
                !query.data
              }
              onClick={() => void save(true)}
            >
              割当を外す
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pending ||
                query.isFetching ||
                query.isError ||
                conflict ||
                !query.data
              }
              onClick={() => void save()}
            >
              {pending ? "保存中" : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </ShiftTimeDialog>
  )
}

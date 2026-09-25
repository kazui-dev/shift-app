import { keys } from "@/data/keys"
import { japanTime } from "@workspace/shared/japan-time"
import { ShiftConflicts } from "./shift-conflicts"
import { ShiftAttendance } from "./shift-attendance"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { MoreHorizontal, Undo2, Redo2, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import {
  getActivity,
  saveActivity,
  copyActivity,
  deleteActivity,
  notifyActivity,
} from "@/api/activities"
import { ApiError, errorMessage } from "@/api/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { assignMember } from "./assign-member"
import { ShiftActionsDialog } from "./shift-actions-dialog"
import { ShiftSettings } from "./shift-settings"
import { planOf, useShiftPlan } from "./use-shift-plan"
import { TimeGrid, type EditorData } from "./time-grid"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

import { Input } from "@workspace/ui/components/input"
import { SelectField } from "@/components/select-field"
import { ShiftNavigation } from "./shift-navigation"

import { useShiftView, type MemberFilters } from "@/components/manage/context"

export function ShiftEditor({
  data: source,
  onStatusChange,
}: {
  data: EditorData
  onStatusChange: (status: { dirty: boolean; pending: boolean }) => void
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [actions, setActions] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [latest, setLatest] = useState<EditorData | null>(null)
  const [conflicted, setConflicted] = useState(false)
  const [selection, setSelection] = useState<ShiftSelection | null>(null)
  const view = useShiftView(source.activity.year)
  const [filters, storeFilters] = useState<MemberFilters>(
    () =>
      view.filters ?? {
        search: "",
        includeUnavailable: true,
        role:
          source.candidateRoleIds.length === 1
            ? (source.candidateRoleIds[0] ?? "")
            : source.candidateRoleIds.length > 1
              ? "candidates"
              : "",
      }
  )
  function setFilters(value: MemberFilters) {
    view.filters = value
    storeFilters(value)
  }
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [pending, setPending] = useState(false)
  const [warning, setWarning] = useState(false)
  const {
    plan,
    base,
    version,
    dirty,
    update,
    confirm,
    rebase,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useShiftPlan(source, pending)
  useEffect(
    () => onStatusChange({ dirty, pending }),
    [dirty, pending, onStatusChange]
  )
  const data = {
    ...source,
    availability: source.availability.filter(
      (window) =>
        Date.parse(window.startsAt) < Date.parse(plan.endsAt) &&
        Date.parse(window.endsAt) > Date.parse(plan.startsAt)
    ),
  }
  function applySelection(value: ShiftSelection): string | null {
    const result = assignMember(plan, value, data.otherAssignments)
    if ("error" in result) return result.error
    update({ ...plan, slots: result.slots })
    setSelection({ ...value, slotId: result.slotId })
    return null
  }
  async function save(confirmed = false) {
    const outside = plan.slots.some((slot) =>
      slot.memberIds.some(
        (memberId) =>
          !data.availability.some(
            (window) =>
              window.memberId === memberId &&
              Date.parse(window.startsAt) <= Date.parse(slot.startsAt) &&
              Date.parse(window.endsAt) >= Date.parse(slot.endsAt)
          )
      )
    )
    if (outside && !confirmed) {
      setWarning(true)
      return
    }
    setPending(true)
    try {
      const result = await saveActivity(data.activity.id, { ...plan, version })
      client.setQueryData(keys.activityEditor(data.activity.id), result)
      confirm(plan, result.activity.version)
      setConflicted(false)
      void Promise.all([
        client.invalidateQueries({
          queryKey: keys.activities(data.activity.year),
        }),
        client.invalidateQueries({ queryKey: keys.assignments() }),
      ])
      toast.success("保存しました。")
    } catch (error) {
      const conflict =
        error instanceof ApiError && error.code === "SHIFT_CHANGED"
      setConflicted(conflict)
      toast.error(`${errorMessage(error)} 編集内容は保持しています。`, {
        action: conflict
          ? {
              label: "最新の変更を確認",
              onClick: () =>
                void action(async () =>
                  setLatest(await getActivity(data.activity.id))
                ),
            }
          : undefined,
      })
    } finally {
      setPending(false)
    }
  }
  async function action(work: () => Promise<unknown>) {
    setPending(true)
    try {
      await work()
      await client.invalidateQueries({
        queryKey: keys.activities(data.activity.year),
      })
      setActions(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <ShiftNavigation activity={data.activity} disabled={pending} />
        <div className="hidden items-center gap-1 md:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="元に戻す"
            disabled={!canUndo || pending}
            onClick={undo}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="やり直す"
            disabled={!canRedo || pending}
            onClick={redo}
          >
            <Redo2 />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAttendanceOpen(true)}
          >
            出勤・連絡
          </Button>
          <Button
            size="sm"
            disabled={pending || (!dirty && !conflicted)}
            onClick={() =>
              conflicted
                ? void action(async () =>
                    setLatest(await getActivity(data.activity.id))
                  )
                : void save()
            }
          >
            {pending ? "保存中" : dirty ? "変更を保存" : "保存済み"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="シフトの操作"
            onClick={() => setActions(true)}
          >
            <MoreHorizontal />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span>
            {japanTime(plan.startsAt)}〜{japanTime(plan.endsAt)}
          </span>
          <span>{plan.place || "場所未設定"}</span>
          <span className="text-muted-foreground">
            責任者：
            {plan.responsibles
              .map(
                (r) =>
                  (r.targetType === "member"
                    ? data.members.find((m) => m.id === r.targetId)?.displayName
                    : data.roles.find((role) => role.id === r.targetId)
                        ?.name) ?? "未設定"
              )
              .join("、")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setSettings(!settings)}
            aria-expanded={settings}
          >
            基本情報を編集
          </Button>
        </div>
        {settings && (
          <ShiftSettings
            plan={plan}
            data={data}
            onSave={(value) => {
              update(value)
              setSettings(false)
            }}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="manage-member-search"
            className="relative w-full md:w-64"
          >
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="manage-member-search"
              className="pl-9"
              aria-label="名前・学籍番号で検索"
              placeholder="名前・学籍番号で検索"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
          </label>
          <SelectField
            aria-label="表示するロール"
            value={filters.role}
            className="hidden w-auto md:flex"
            options={[
              { value: "", label: "すべてのロール" },
              ...data.roles.map((role) => ({
                value: role.id,
                label: role.name,
              })),
            ]}
            onValueChange={(role) => setFilters({ ...filters, role })}
          />
          <label className="ml-2 hidden items-center gap-2 text-sm md:flex">
            <input
              type="checkbox"
              checked={filters.includeUnavailable}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  includeUnavailable: event.target.checked,
                })
              }
            />
            参加不可・未回答も表示
          </label>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <fieldset
            disabled={pending}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 lg:pr-4"
          >
            <TimeGrid
              data={data}
              plan={plan}
              role={filters.role}
              search={filters.search}
              includeUnavailable={filters.includeUnavailable}
              selection={selection}
              onSelect={setSelection}
              onCommit={(value) => {
                const error = applySelection(value)
                if (error) toast.error(error)
              }}
              onMember={(memberId) =>
                setSelection({
                  memberId,
                  slotId: null,
                  startsAt: plan.startsAt,
                  endsAt: plan.endsAt,
                })
              }
            />
          </fieldset>
          {selection && (
            <ShiftSelectionPanel
              key={selection.memberId}
              selection={selection}
              slots={plan.slots}
              startsAt={plan.startsAt}
              endsAt={plan.endsAt}
              data={data}
              pending={pending}
              onClose={() => setSelection(null)}
              onApply={applySelection}
              onRemove={(slotId) => {
                update({
                  ...plan,
                  slots: plan.slots.map((slot) =>
                    slot.id === slotId
                      ? {
                          ...slot,
                          memberIds: slot.memberIds.filter(
                            (id) => id !== selection.memberId
                          ),
                        }
                      : slot
                  ),
                })
              }}
            />
          )}
        </div>
      </div>
      {actions && (
        <ShiftActionsDialog
          dirty={dirty}
          pending={pending}
          active={plan.active}
          onClose={() => setActions(false)}
          onSettings={() => {
            setActions(false)
            setSettings(true)
          }}
          onAttendance={() => {
            setActions(false)
            setAttendanceOpen(true)
          }}
          onNotify={() =>
            void action(async () => {
              await notifyActivity(data.activity.id)
              toast.success("更新を通知しました。")
            })
          }
          onCopy={(date) =>
            void action(async () => {
              const copy = await copyActivity(data.activity.id, date)
              await navigate({
                to: "/manage/shifts/$shiftId",
                params: { shiftId: copy.id },
              })
            })
          }
          onDelete={() => {
            setActions(false)
            setDeleting(true)
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="シフトを削除しますか"
          confirmLabel="削除する"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false)
            void action(async () => {
              await deleteActivity(data.activity.id)
              await navigate({ to: "/manage/shifts" })
            })
          }}
        />
      )}
      {latest && (
        <ShiftConflicts
          base={base}
          data={latest}
          local={plan}
          latest={planOf(latest)}
          onClose={() => setLatest(null)}
          onMerge={(merged) => {
            client.setQueryData(keys.activityEditor(data.activity.id), latest)
            rebase(latest, merged)
            setLatest(null)
            setConflicted(false)
          }}
        />
      )}
      {attendanceOpen && (
        <ShiftAttendance
          activityId={data.activity.id}
          onClose={() => setAttendanceOpen(false)}
        />
      )}
      {warning && (
        <ConfirmDialog
          title="希望時間外の勤務を含めて保存しますか"
          confirmLabel="保存する"
          onCancel={() => setWarning(false)}
          onConfirm={() => {
            setWarning(false)
            void save(true)
          }}
        />
      )}
    </>
  )
}

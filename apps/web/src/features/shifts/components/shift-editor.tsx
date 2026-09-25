import { keys } from "@/app/data/keys"
import { japanTime } from "@workspace/shared/japan-time"
import { ShiftConflicts } from "./shift-conflicts"
import { ShiftAttendance } from "./shift-attendance"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import {
  getActivity,
  saveActivity,
  copyActivity,
  deleteActivity,
  notifyActivity,
} from "@/features/shifts/api/activities"
import { ApiError, errorMessage } from "@/lib/http/client"
import {
  availabilityDuringShift,
  hasAssignmentOutsideAvailability,
} from "@/features/shifts/lib/availability"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { assignMember } from "./assign-member"
import { ShiftActionsDialog } from "./shift-actions-dialog"
import { ShiftSettings } from "./shift-settings"
import { planOf, useShiftPlan } from "./use-shift-plan"
import { TimeGrid } from "./time-grid"
import type { EditorData } from "../editor-data"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

import { ShiftEditorToolbar } from "./shift-editor-toolbar"
import { MemberFilterBar } from "./member-filter-bar"

import {
  useShiftView,
  type MemberFilters,
} from "@/features/shifts/shift-view-context"

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
    availability: availabilityDuringShift(source.availability, plan),
  }
  function applySelection(value: ShiftSelection): string | null {
    const result = assignMember(plan, value, data.otherAssignments)
    if ("error" in result) return result.error
    update({ ...plan, slots: result.slots })
    setSelection({ ...value, slotId: result.slotId })
    return null
  }
  async function save(confirmed = false) {
    const outside = hasAssignmentOutsideAvailability(plan, data.availability)
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
      <ShiftEditorToolbar
        activity={data.activity}
        dirty={dirty}
        pending={pending}
        conflicted={conflicted}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onAttendance={() => setAttendanceOpen(true)}
        onSave={() =>
          conflicted
            ? void action(async () =>
                setLatest(await getActivity(data.activity.id))
              )
            : void save()
        }
        onActions={() => setActions(true)}
      />
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
        <MemberFilterBar
          filters={filters}
          roles={data.roles}
          onChange={setFilters}
        />
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

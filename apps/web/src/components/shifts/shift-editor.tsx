import { keys } from "@/data/keys"
import { japanDateWeekday } from "@workspace/shared/japan-time"
import { ShiftConflicts } from "./shift-conflicts"
import { ShiftAttendance } from "./shift-attendance"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { MoreHorizontal } from "lucide-react"
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
import { ShiftFiltersDialog, type MemberFilters } from "./shift-filters-dialog"
import { ShiftSettings } from "./shift-settings-dialog"
import { planOf, useShiftPlan } from "./use-shift-plan"
import { TimeGrid, type EditorData } from "./time-grid"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

import { ResponsivePageHeader } from "@workspace/ui/components/responsive-page"

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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [latest, setLatest] = useState<EditorData | null>(null)
  const [conflicted, setConflicted] = useState(false)
  const [selection, setSelection] = useState<ShiftSelection | null>(null)
  const [filters, setFilters] = useState<MemberFilters>({
    search: "",
    includeUnavailable: false,
    role:
      source.candidateRoleIds.length === 1
        ? (source.candidateRoleIds[0] ?? "")
        : source.candidateRoleIds.length > 1
          ? "candidates"
          : "",
  })
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [pending, setPending] = useState(false)
  const [warning, setWarning] = useState(false)
  const { plan, base, version, dirty, update, confirm, rebase } = useShiftPlan(
    source,
    pending
  )
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
  const close = () => {
    if (pending) return
    void navigate({ to: "/manage/shifts", replace: true })
  }
  return (
    <>
      <ResponsivePageHeader
        title={plan.name}
        onBack={close}
        backDisabled={pending}
        action={
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
            保存
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {japanDateWeekday(plan.startsAt)}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="シフトの操作"
            disabled={pending}
            onClick={() => setActions(true)}
          >
            <MoreHorizontal />
          </Button>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <fieldset
            disabled={pending}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:pr-4"
          >
            <div className="flex flex-wrap items-center gap-2 pl-38 sm:pl-46">
              <div className="mr-auto flex w-full items-center gap-4 text-xs text-muted-foreground sm:w-auto">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-[22px] rounded-[3px] bg-[#e7edf3] dark:bg-slate-800" />
                  希望時間
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-[22px] rounded-[3px]"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${plan.color} 22%, var(--background))`,
                    }}
                  />
                  シフト
                </span>
              </div>
            </div>
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
              onFilter={() => setFiltersOpen(true)}
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
      {filtersOpen && (
        <ShiftFiltersDialog
          filters={filters}
          plan={plan}
          roles={data.roles}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
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
      {settings && (
        <ShiftSettings
          plan={plan}
          data={data}
          onClose={() => setSettings(false)}
          onSave={(value) => {
            update(value)
            setSettings(false)
          }}
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

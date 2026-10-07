import { Button } from "@workspace/ui/components/button"
import { gridMembers } from "./time-scale"
import { BulkAssignmentDialog } from "./bulk-assignment-dialog"
import { keys } from "@/app/data/keys"
import { ShiftConflicts } from "./shift-conflicts"
import { ShiftAttendance } from "./shift-attendance"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "@workspace/ui/lib/toast"
import {
  getActivity,
  saveActivity,
  copyActivity,
  deleteActivity,
  notifyActivity,
} from "@/features/shifts/api/activities"
import { ApiError, errorMessage } from "@/lib/http/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { assignMember } from "./assign-member"
import { ShiftActionsDialog } from "./shift-actions-dialog"
import { planOf, useShiftPlan } from "./use-shift-plan"
import { TimeGrid } from "./time-grid"
import type { EditorData } from "../editor-data"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

import { ShiftEditorToolbar } from "./shift-editor-toolbar"
import { MemberFilterBar } from "./member-filter-bar"
import { hasUnavailableAssignments } from "./availability-warning"

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
  const [acknowledged, setAcknowledged] = useState<EditorData["availability"]>(
    []
  )
  const [bulkMembers, setBulkMembers] = useState<string[] | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
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
        includeUnavailable: false,
        includeUnanswered: false,
        role:
          source.candidateRoleIds.length === 1
            ? (source.candidateRoleIds[0] ?? "")
            : source.candidateRoleIds.length > 1
              ? "candidates"
              : "",
      }
  )
  function setFilters(value: MemberFilters) {
    view.save({ filters: value })
    storeFilters(value)
  }
  const [attendanceOpen, setAttendanceOpen] = useState(false)
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
    setSelection(null)
    return null
  }
  async function save(confirmed = false) {
    if (
      hasUnavailableAssignments(plan, data.availability, acknowledged) &&
      !confirmed
    ) {
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
        <MemberFilterBar
          onBulkAssign={() => {
            setSelection(null)
            setBulkMembers((current) => (current === null ? [] : null))
          }}
          disabled={pending}
          filters={filters}
          roles={data.roles}
          onChange={setFilters}
        />
        {bulkMembers !== null && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="tabular-nums">{bulkMembers.length}人選択</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setBulkMembers(data.members.map((member) => member.id))
              }
            >
              全メンバー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setBulkMembers((current) => [
                  ...new Set([
                    ...(current ?? []),
                    ...gridMembers(data, plan, filters).map(
                      (member) => member.id
                    ),
                  ]),
                ])
              }
            >
              表示中を選択
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkMembers([])}
            >
              選択解除
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setBulkMembers(null)}
            >
              取消
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!bulkMembers.length || pending}
              onClick={() => setBulkOpen(true)}
            >
              時間を指定
            </Button>
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <fieldset
            disabled={pending}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-0"
          >
            <TimeGrid
              data={data}
              bulkSelection={
                bulkMembers === null
                  ? undefined
                  : {
                      memberIds: bulkMembers,
                      toggle: (memberId) =>
                        setBulkMembers((current) =>
                          current?.includes(memberId)
                            ? current.filter((id) => id !== memberId)
                            : [...(current ?? []), memberId]
                        ),
                    }
              }
              plan={plan}
              role={filters.role}
              search={filters.search}
              includeUnavailable={filters.includeUnavailable}
              includeUnanswered={filters.includeUnanswered}
              selection={selection}
              onSelect={setSelection}
              onCommit={(value) => {
                const error = applySelection(value)
                if (error) toast.error(error)
              }}
              onMember={(memberId) => {
                const slot = plan.slots.find((item) =>
                  item.memberIds.includes(memberId)
                )
                setSelection({
                  memberId,
                  slotId: slot?.id ?? null,
                  startsAt: slot?.startsAt ?? plan.startsAt,
                  endsAt: slot?.endsAt ?? plan.endsAt,
                })
              }}
            />
          </fieldset>
          {selection && (
            <ShiftSelectionPanel
              key={`${selection.memberId}-${selection.slotId ?? "new"}`}
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
      {bulkOpen && bulkMembers !== null && (
        <BulkAssignmentDialog
          memberIds={bulkMembers}
          data={data}
          plan={plan}
          onApply={(next, accepted) => {
            update(next)
            setBulkMembers(null)
            setAcknowledged((current) => [...current, ...accepted])
          }}
          onClose={() => setBulkOpen(false)}
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
            void navigate({
              to: "/manage/shifts/$shiftId/settings",
              params: { shiftId: data.activity.id },
            })
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
                ignoreBlocker: true,
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
          title={`「${data.activity.name}」を削除しますか`}
          description="勤務の割当と、このシフトのチャットも削除されます。元に戻せません。"
          confirmLabel="削除する"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false)
            void action(async () => {
              await deleteActivity(data.activity.id)
              await Promise.all([
                client.invalidateQueries({
                  queryKey: keys.activities(data.activity.year),
                }),
                client.invalidateQueries({ queryKey: keys.assignments() }),
                client.invalidateQueries({ queryKey: keys.chatRooms() }),
              ])
              await navigate({
                to: "/manage/shifts",
                replace: true,
                ignoreBlocker: true,
              })
              client.removeQueries({
                queryKey: keys.activityEditor(data.activity.id),
                exact: true,
              })
              toast.success("シフトを削除しました。")
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

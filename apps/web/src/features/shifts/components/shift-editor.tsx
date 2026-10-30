import type {
  ActivityEditorInput,
  AssignmentOverwriteReview,
} from "@workspace/shared/shifts"
import { AssignmentOverwriteDialog } from "./assignment-overwrite-dialog"
import { emptyFilter } from "@workspace/ui/lib/filters"
import { useAssignmentSelection } from "./use-assignment-selection"
import {
  assignmentKey,
  memberSelectionKeys,
  removeAssignments,
} from "./assignment-removal"
import {
  AssignmentSelectionArea,
  AssignmentSelectionToolbar,
} from "./assignment-selection"
import { japanTime } from "@workspace/shared/japan-time"
import { gridMembers } from "./time-scale"
import { BulkAssignmentDialog } from "./bulk-assignment-dialog"
import { keys } from "@/app/data/keys"
import { ShiftConflicts } from "./shift-conflicts"
import { ShiftAttendance } from "./shift-attendance"
import { attendanceQuery } from "../data/attendance"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "@workspace/ui/lib/toast"
import {
  getActivity,
  saveActivity,
  reviewActivityOverlaps,
  overwriteActivity,
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
  const attendance = useQuery(attendanceQuery(source.activity.id))
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
  const viewport = useRef<HTMLDivElement>(null)
  const initialScrollTop = useRef(view.scrollTop)
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = initialScrollTop.current
  }, [])
  const [filters, storeFilters] = useState<MemberFilters>(
    () =>
      view.filters ?? {
        search: "",
        availability: { values: ["available"], mode: "include" },
        roles: source.candidateRoleIds.length
          ? { values: [...source.candidateRoleIds], mode: "include" }
          : emptyFilter(),
      }
  )
  function setFilters(value: MemberFilters) {
    removal.end()
    if (viewport.current) viewport.current.scrollTop = 0
    view.save({ filters: value, scrollTop: 0 })
    storeFilters(value)
  }
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [warning, setWarning] = useState(false)
  const [overwrite, setOverwrite] = useState<{
    plan: ActivityEditorInput
    review: AssignmentOverwriteReview
  } | null>(null)
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
  const visibleMembers = new Set(
    gridMembers(data, plan, filters).map((member) => member.id)
  )
  const removable = plan.slots.flatMap((slot) =>
    slot.memberIds
      .filter((memberId) => visibleMembers.has(memberId))
      .map((memberId) => ({
        activityId: data.activity.id,
        slotId: slot.id,
        memberId,
      }))
  )
  const removal = useAssignmentSelection(
    `${data.activity.id}:${JSON.stringify(filters)}`,
    [...visibleMembers].flatMap((memberId) =>
      memberSelectionKeys(data.activity.id, memberId, plan.slots)
    )
  )
  const selectedMemberIds = [...visibleMembers].filter((memberId) =>
    memberSelectionKeys(data.activity.id, memberId, plan.slots).some((key) =>
      removal.keys.includes(key)
    )
  )
  function applySelection(value: ShiftSelection): string | null {
    const result = assignMember(plan, value, [])
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
        client.invalidateQueries({
          queryKey: keys.shiftAttendance(data.activity.id),
        }),
      ])
      toast.success("保存しました。")
    } catch (error) {
      if (error instanceof ApiError && error.code === "SHIFT_OVERLAP") {
        const input = { ...plan, version }
        try {
          const review = await reviewActivityOverlaps(data.activity.id, input)
          if (review.changes.length) setOverwrite({ plan: input, review })
          else {
            await acceptOverwrite(
              input,
              await overwriteActivity(data.activity.id, input, review.token)
            )
            toast.success("保存しました。")
          }
        } catch (failure) {
          toast.error(errorMessage(failure))
        }
        return
      }
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
  async function acceptOverwrite(
    input: ActivityEditorInput,
    result: EditorData
  ) {
    client.setQueryData(keys.activityEditor(data.activity.id), result)
    confirm(input, result.activity.version)
    setConflicted(false)
    setOverwrite(null)
    await Promise.allSettled(
      [
        keys.activityEditor(),
        keys.activities(data.activity.year),
        keys.assignments(),
        keys.shiftOverview(),
        keys.shiftAttendance(),
        keys.chatRooms(),
      ].map((queryKey) => client.invalidateQueries({ queryKey }))
    )
  }
  async function saveOverwrite() {
    if (!overwrite || pending) return
    setPending(true)
    try {
      const result = await overwriteActivity(
        data.activity.id,
        overwrite.plan,
        overwrite.review.token
      )
      await acceptOverwrite(overwrite.plan, result)
      toast.success("上書き保存しました。")
    } catch (error) {
      toast.error(errorMessage(error))
      if (
        error instanceof ApiError &&
        error.code === "ASSIGNMENT_OVERWRITE_CHANGED"
      ) {
        try {
          setOverwrite({
            ...overwrite,
            review: await reviewActivityOverlaps(
              data.activity.id,
              overwrite.plan
            ),
          })
        } catch (failure) {
          setOverwrite(null)
          toast.error(errorMessage(failure))
        }
      } else if (error instanceof ApiError && error.code === "SHIFT_CHANGED") {
        setOverwrite(null)
        setConflicted(true)
      }
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
    <div
      ref={viewport}
      className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto"
      onScroll={(event) =>
        view.save({ scrollTop: event.currentTarget.scrollTop })
      }
    >
      {overwrite && (
        <AssignmentOverwriteDialog
          review={overwrite.review}
          plan={overwrite.plan}
          pending={pending}
          onCancel={() => setOverwrite(null)}
          onConfirm={() => void saveOverwrite()}
        />
      )}
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
      <div className="space-y-3 px-4 pb-4 sm:px-6">
        <MemberFilterBar
          filters={filters}
          roles={data.roles}
          onChange={setFilters}
        >
          <AssignmentSelectionToolbar
            selection={removal}
            details={removable.map((target) => {
              const slot = plan.slots.find((item) => item.id === target.slotId)
              const member = data.members.find(
                (item) => item.id === target.memberId
              )
              return {
                key: assignmentKey(target),
                name: member?.displayName ?? "",
                activity: data.activity.name,
                time: slot
                  ? `${japanTime(slot.startsAt)}〜${japanTime(slot.endsAt)}`
                  : "",
              }
            })}
            pending={pending}
            summary={`${selectedMemberIds.length}人選択中`}
            onAssign={() => {
              setSelection(null)
              setBulkMembers(selectedMemberIds)
              setBulkOpen(true)
            }}
            onRemove={() => {
              const targets = removable.filter((target) =>
                removal.keys.includes(assignmentKey(target))
              )
              update(removeAssignments(plan, targets))
              toast.success(
                `${targets.length}件の勤務を解除しました。保存すると確定します。`
              )
              removal.end()
            }}
          />
        </MemberFilterBar>
        <div className="min-w-0">
          {attendance.isPending && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              勤怠を読み込み中…
            </p>
          )}
          {attendance.isError && (
            <p role="alert" className="px-3 py-2 text-sm">
              勤怠を読み込めませんでした。
              <Button
                variant="outline"
                size="sm"
                onClick={() => void attendance.refetch()}
              >
                再読み込み
              </Button>
            </p>
          )}
          <fieldset disabled={pending} className="min-w-0">
            <AssignmentSelectionArea selection={removal}>
              <TimeGrid
                assignmentSelection={removal}
                data={data}
                attendance={attendance.data?.assignments ?? []}
                plan={plan}
                roles={filters.roles}
                search={filters.search}
                availability={filters.availability}
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
            </AssignmentSelectionArea>
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
            removal.end()
            setAcknowledged((current) => [...current, ...accepted])
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {actions && (
        <ShiftActionsDialog
          startsAt={plan.startsAt}
          endsAt={plan.endsAt}
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
          onCopy={(date, startsAt, endsAt) =>
            void action(async () => {
              const copy = await copyActivity(
                data.activity.id,
                date,
                startsAt,
                endsAt
              )
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
    </div>
  )
}

import { saveActivityDraft, saveActivityDrafts } from "./save-activity-drafts"
import { useAttendanceColors } from "./use-attendance-colors"
import { ScrollViewport } from "@workspace/ui/components/scroll-viewport"
import type {
  ActivityEditorInput,
  AssignmentOverwriteReview,
} from "@workspace/shared/shifts"
import { AssignmentOverwriteDialog } from "./assignment-overwrite-dialog"
import { emptyFilter, pruneFilter } from "@workspace/ui/lib/filters"
import type { ShiftAnchor } from "./shift-anchor"
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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
import { type ShiftSelection } from "./shift-selection-panel"
import { AssignmentPanel } from "./assignment-panel"

import { ShiftEditorToolbar } from "./shift-editor-toolbar"
import { MemberFilterBar } from "./member-filter-bar"
import { hasUnavailableAssignments } from "./availability-warning"

import {
  useShiftView,
  type MemberFilters,
} from "@/features/shifts/shift-view-context"

export function ShiftEditor({
  data: source,
  optionsReady,
  onStatusChange,
}: {
  data: EditorData
  optionsReady: boolean
  onStatusChange: (status: { dirty: boolean; pending: boolean }) => void
}) {
  const client = useQueryClient()
  const attendanceColors = useAttendanceColors()
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
  const [selection, setSelection] = useState<
    (ShiftSelection & { anchor: ShiftAnchor; activityId?: string }) | null
  >(null)
  const select = useCallback(
    (value: ShiftSelection, anchor: ShiftAnchor) =>
      setSelection({ ...value, anchor }),
    []
  )
  const selectOther = useCallback(
    (item: EditorData["otherAssignments"][number], anchor: ShiftAnchor) => {
      if (item.activityId && item.slotId)
        setSelection({
          ...item,
          slotId: item.slotId,
          activityId: item.activityId,
          anchor,
        })
    },
    []
  )
  const view = useShiftView(source.activity.year, source.activity.id)
  const viewport = useRef<HTMLDivElement>(null)
  const initialScrollTop = useRef(view.scrollTop)
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = initialScrollTop.current
  }, [])
  const filters: MemberFilters = useMemo(
    () =>
      view.filters ?? {
        search: "",
        availability: { include: ["available"], exclude: [] },
        roles: source.candidateRoleIds.length
          ? { include: [...source.candidateRoleIds], exclude: [] }
          : emptyFilter(),
      },
    [view.filters, source.candidateRoleIds]
  )
  function setFilters(value: MemberFilters) {
    removal.end()
    if (viewport.current) viewport.current.scrollTop = 0
    view.save({ filters: value, scrollTop: 0 })
  }
  useEffect(() => {
    if (!optionsReady || !view.filters) return
    const roles = pruneFilter(filters.roles, [
      "unset",
      ...source.roles.map((role) => role.id),
    ])
    const availability = pruneFilter(filters.availability, [
      "available",
      "unavailable",
      "unanswered",
    ])
    if (roles !== filters.roles || availability !== filters.availability)
      view.save({ filters: { ...filters, roles, availability } })
  }, [optionsReady, source.roles, view, filters])
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [warning, setWarning] = useState(false)
  const [overwrite, setOverwrite] = useState<{
    plan: ActivityEditorInput
    review: AssignmentOverwriteReview
  } | null>(null)
  const {
    plan,
    related,
    updateMany,
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
  const data = useMemo(
    () => ({
      ...source,
      otherAssignments: [
        ...source.otherAssignments.filter(
          (item) => !item.activityId || !related[item.activityId]
        ),
        ...Object.entries(related).flatMap(([activityId, draft]) =>
          draft.plan.slots.flatMap((slot) =>
            slot.memberIds.map((memberId) => ({
              activityId,
              slotId: slot.id,
              memberId,
              name: draft.plan.name,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
            }))
          )
        ),
      ],
      availability: source.availability.filter(
        (window) =>
          Date.parse(window.startsAt) < Date.parse(plan.endsAt) &&
          Date.parse(window.endsAt) > Date.parse(plan.startsAt)
      ),
    }),
    [source, related, plan.startsAt, plan.endsAt]
  )
  const visibleMembers = useMemo(
    () => new Set(gridMembers(data, plan, filters).map((member) => member.id)),
    [data, plan, filters]
  )
  const availableKeys = useMemo(
    () =>
      [...visibleMembers].flatMap((memberId) =>
        memberSelectionKeys(data.activity.id, memberId, plan.slots)
      ),
    [visibleMembers, data.activity.id, plan.slots]
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
    availableKeys
  )
  const selectedMemberIds = [...visibleMembers].filter((memberId) =>
    memberSelectionKeys(data.activity.id, memberId, plan.slots).some((key) =>
      removal.keys.includes(key)
    )
  )
  const applySelection = useCallback(
    (value: ShiftSelection): string | null => {
      const result = assignMember(plan, value, [])
      if ("error" in result) return result.error
      update({ ...plan, slots: result.slots })
      setSelection(null)
      return null
    },
    [plan, update]
  )
  const commitSelection = useCallback(
    (value: ShiftSelection) => {
      const error = applySelection(value)
      if (error) toast.error(error)
    },
    [applySelection]
  )
  const selectMember = useCallback(
    (memberId: string, anchor: ShiftAnchor) => {
      const slot = plan.slots.find((item) => item.memberIds.includes(memberId))
      setSelection({
        anchor,
        memberId,
        slotId: slot?.id ?? null,
        startsAt: slot?.startsAt ?? plan.startsAt,
        endsAt: slot?.endsAt ?? plan.endsAt,
      })
    },
    [plan]
  )
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
      if (Object.keys(related).length) {
        const result = await saveActivityDrafts({
          ...related,
          [data.activity.id]: { base, plan: { ...plan, version } },
        })
        for (const saved of result.activities)
          client.setQueryData(keys.activityEditor(saved.activity.id), saved)
        const own = result.activities.find(
          (saved) => saved.activity.id === data.activity.id
        )
        if (own) confirm(planOf(own), own.activity.version)
        await Promise.allSettled(
          [
            keys.activityEditor(),
            keys.activities(),
            keys.assignments(),
            keys.shiftOverview(),
            keys.shiftAttendance(),
            keys.chatRooms(),
          ].map((queryKey) => client.invalidateQueries({ queryKey }))
        )
        toast.success("保存しました。")
        return
      }
      const result = await saveActivityDraft(
        data.activity.id,
        { base, plan: { ...plan, version } },
        async (id, merged) => {
          try {
            return await saveActivity(id, merged)
          } catch (error) {
            if (error instanceof ApiError && error.code === "SHIFT_OVERLAP") {
              const review = await reviewActivityOverlaps(id, merged)
              if (review.changes.length) {
                setOverwrite({ plan: merged, review })
              } else {
                return overwriteActivity(id, merged, review.token)
              }
            }
            throw error
          }
        }
      )
      client.setQueryData(keys.activityEditor(data.activity.id), result)
      confirm(planOf(result), result.activity.version)
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
      if (Object.keys(related).length) {
        toast.error(`${errorMessage(error)} 編集内容は保持しています。`)
        return
      }
      if (error instanceof ApiError && error.code === "SHIFT_OVERLAP") return
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
  async function acceptOverwrite(result: EditorData) {
    client.setQueryData(keys.activityEditor(data.activity.id), result)
    confirm(planOf(result), result.activity.version)
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
      await acceptOverwrite(result)
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
  const toolbar = (
    <ShiftEditorToolbar
      attendanceColors={attendanceColors.enabled}
      onAttendanceColorsChange={attendanceColors.toggle}
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
      filters={
        <MemberFilterBar
          filters={filters}
          roles={data.roles}
          onChange={setFilters}
        />
      }
      selection={
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
      }
    />
  )
  return (
    <ScrollViewport
      ref={viewport}
      contentClassName="space-y-3"
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

      <div className="min-w-0">
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
              toolbar={toolbar}
              assignmentSelection={removal}
              data={data}
              attendance={attendance.data?.assignments}
              timelineAttendance={attendance.data?.timelineAssignments}
              attendanceColors={attendanceColors.enabled}
              plan={plan}
              roles={filters.roles}
              search={filters.search}
              availability={filters.availability}
              selection={selection}
              onSelect={select}
              onCommit={commitSelection}
              onMember={selectMember}
              onOther={selectOther}
            />
          </AssignmentSelectionArea>
        </fieldset>
        {selection && (
          <AssignmentPanel
            anchor={selection.anchor}
            selection={selection}
            activityId={selection.activityId ?? source.activity.id}
            source={data}
            drafts={{
              ...related,
              [source.activity.id]: { base, plan: { ...plan, version } },
            }}
            pending={pending}
            onClose={() => setSelection(null)}
            onApply={updateMany}
          />
        )}
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
    </ScrollViewport>
  )
}

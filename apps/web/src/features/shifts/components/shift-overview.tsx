import { filterValues, filterDescription } from "@workspace/ui/lib/filters"
import { OverviewBulkAssignment } from "./overview-bulk-assignment"
import { AssignmentOverwriteDialog } from "./assignment-overwrite-dialog"
import { useCurrentTime } from "@/lib/hooks/use-current-time"
import { useAssignmentSelection } from "./use-assignment-selection"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/lib/toast"
import { errorMessage } from "@/lib/http/client"
import { activityQuery } from "../data/activities"
import {
  assignmentKey,
  overviewMemberKeys,
  prepareAssignmentRemoval,
} from "./assignment-removal"
import {
  AssignmentSelectionArea,
  AssignmentSelectionToolbar,
} from "./assignment-selection"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Undo2,
  Redo2,
  Save,
  Printer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ShiftMemberSearch } from "./shift-member-search"
import { ShiftWorkspaceToolbar } from "./shift-workspace-toolbar"
import { ManagementViewport } from "@/features/management/components/viewport"
import { AttendanceColorsControl } from "./attendance-colors-control"
import { japanDateTime, japanTime } from "@workspace/shared/japan-time"
import { activitiesQuery } from "../data/activities"
import { rolesQuery } from "@/features/years/data/years"
import { overviewQuery } from "../data/overview"

import { FilterMenu } from "@workspace/ui/components/filter-menu"
import { emptyFilter, pruneFilter } from "@workspace/ui/lib/filters"
import { OverviewGrid } from "./overview-grid"
import { OverviewEditor } from "./overview-editor"
import { ShiftAttendance } from "./shift-attendance"
import {
  overviewInitialDate,
  overviewRows,
  type OverviewFilters,
  type OverviewSelection,
} from "./overview-model"
import { useShiftView } from "../shift-view-context"
import "./overview.css"
import { useManagement } from "@/features/management/management-context"
import { useOverviewDraft } from "./use-overview-draft"
import { projectOverview } from "./overview-draft"
import { useAttendanceColors } from "./use-attendance-colors"
import type { ShiftAnchor } from "./shift-anchor"

type OverviewStatus = { dirty: boolean; pending: boolean }

export function ShiftOverview({
  year,
  onStatusChange,
}: {
  year: number
  onStatusChange: (status: OverviewStatus) => void
}) {
  const now = useCurrentTime()
  const view = useShiftView(year)
  const activities = useQuery({
    ...activitiesQuery(year),
    enabled: !view.overview,
  })
  if (!view.overview && !activities.data)
    return (
      <div className="space-y-4">
        {activities.isError ? (
          <p role="alert" className="text-sm text-destructive">
            シフトの日程を取得できませんでした。
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void activities.refetch()}
            >
              再試行
            </Button>
          </p>
        ) : (
          <output
            aria-label="シフトの日程を読み込み中"
            className="block h-14 border-b bg-muted/20"
          />
        )}
      </div>
    )
  return (
    <ShiftOverviewContent
      year={year}
      onStatusChange={onStatusChange}
      initialDate={
        view.overview?.date ??
        overviewInitialDate(
          activities.data?.activities ?? [],
          japanDateTime(now).date
        )
      }
    />
  )
}

function ShiftOverviewContent({
  year,
  initialDate,
  onStatusChange,
}: {
  year: number
  onStatusChange: (status: OverviewStatus) => void
  initialDate: string
}) {
  const draft = useOverviewDraft()
  const attendanceColors = useAttendanceColors()
  const client = useQueryClient()
  const [bulkMembers, setBulkMembers] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState(false)
  const pending = draft.pending || removing
  const { setDirty } = useManagement()
  const pickerRef = useRef<HTMLInputElement>(null)
  const view = useShiftView(year)
  const filters: OverviewFilters = useMemo(
    () =>
      view.overview ?? {
        date: initialDate,
        roles: emptyFilter(),
        activities: emptyFilter(),
        search: "",
      },
    [view.overview, initialDate]
  )
  const [selection, setSelection] = useState<{
    value: OverviewSelection
    anchor: ShiftAnchor
  } | null>(null)
  const [attendance, setAttendance] = useState<string | null>(null)
  useEffect(() => {
    setDirty(draft.dirty || pending)
    onStatusChange({ dirty: draft.dirty, pending })
    return () => {
      setDirty(false)
      onStatusChange({ dirty: false, pending: false })
    }
  }, [draft.dirty, pending, setDirty, onStatusChange])
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const done = () => {
      document.body.classList.remove("printing-shift-overview")
      setPrinting(false)
    }
    window.addEventListener("afterprint", done)
    return () => {
      window.removeEventListener("afterprint", done)
      document.body.classList.remove("printing-shift-overview")
    }
  }, [])
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const query = useQuery(overviewQuery(year, filters.date))
  const activityOptions = useQuery(activitiesQuery(year))
  const roleOptions = useQuery(rolesQuery(year))
  useEffect(() => {
    if (!view.overview) return
    // The overview response is limited to a day; absence there does not mean deletion.
    const roles =
      roleOptions.isSuccess && !roleOptions.isFetching
        ? pruneFilter(
            filters.roles,
            roleOptions.data.roles.map((role) => role.id)
          )
        : filters.roles
    const activities =
      activityOptions.isSuccess && !activityOptions.isFetching
        ? pruneFilter(
            filters.activities,
            activityOptions.data.activities.map((activity) => activity.id)
          )
        : filters.activities
    if (roles !== filters.roles || activities !== filters.activities)
      view.save({ overview: { ...filters, roles, activities } })
  }, [
    roleOptions.isSuccess,
    roleOptions.isFetching,
    roleOptions.data,
    activityOptions.isSuccess,
    activityOptions.isFetching,
    activityOptions.data,
    view,
    filters,
  ])
  const data = useMemo(
    () => (query.data ? projectOverview(query.data, draft.drafts) : undefined),
    [query.data, draft.drafts]
  )
  const rows = useMemo(
    () => (data ? overviewRows(data, filters) : []),
    [data, filters]
  )
  const availableKeys = useMemo(
    () =>
      rows.flatMap((row) => overviewMemberKeys(row.member.id, row.assignments)),
    [rows]
  )
  const removable = rows.flatMap((row) => row.assignments)
  const removal = useAssignmentSelection(JSON.stringify(filters), availableKeys)
  const selectedMemberIds = rows
    .filter((row) =>
      overviewMemberKeys(row.member.id, row.assignments).some((key) =>
        removal.keys.includes(key)
      )
    )
    .map((row) => row.member.id)
  const select = useCallback(
    (value: OverviewSelection, anchor: ShiftAnchor) => {
      if (!pending) setSelection({ value, anchor })
    },
    [pending]
  )
  async function removeSelected() {
    if (pending) return
    setRemoving(true)
    try {
      const targets = removable.filter((target) =>
        removal.keys.includes(assignmentKey(target))
      )
      const updates = await prepareAssignmentRemoval(
        targets,
        draft.drafts,
        (id) => client.fetchQuery({ ...activityQuery(id), staleTime: 0 })
      )
      draft.updateMany(updates)
      removal.end()
      toast.success(
        `${targets.length}件の勤務を解除しました。保存すると確定します。`
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setRemoving(false)
    }
  }
  function change(patch: Partial<OverviewFilters>) {
    removal.end()
    const next = { ...filters, ...patch }
    view.save({ overview: next })
  }
  const toolbar = (
    <ShiftWorkspaceToolbar
      label="全体シフトの操作"
      leading={
        <div className="relative flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="前日"
            onClick={() =>
              change({
                date: new Date(
                  Date.parse(`${filters.date}T00:00:00Z`) - 86_400_000
                )
                  .toISOString()
                  .slice(0, 10),
              })
            }
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="font-semibold"
            aria-label={`${filters.date}、日付を選択`}
            onClick={() => {
              const picker = pickerRef.current
              if (!picker) return
              if (typeof picker.showPicker === "function") picker.showPicker()
              else picker.click()
            }}
          >
            {new Date(`${filters.date}T00:00:00+09:00`).toLocaleDateString(
              "ja-JP",
              {
                month: "long",
                day: "numeric",
                weekday: "short",
                timeZone: "Asia/Tokyo",
              }
            )}
          </Button>
          <input
            ref={pickerRef}
            aria-label="表示日"
            type="date"
            value={filters.date}
            className="pointer-events-none absolute size-px opacity-0"
            tabIndex={-1}
            onChange={(event) => {
              if (event.target.value) change({ date: event.target.value })
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="翌日"
            onClick={() =>
              change({
                date: new Date(
                  Date.parse(`${filters.date}T00:00:00Z`) + 86_400_000
                )
                  .toISOString()
                  .slice(0, 10),
              })
            }
          >
            <ChevronRight />
          </Button>
        </div>
      }
      actions={
        <>
          <AttendanceColorsControl
            checked={attendanceColors.enabled}
            onCheckedChange={attendanceColors.toggle}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="全体シフトを更新"
            disabled={query.isFetching || pending}
            onClick={() => void query.refetch()}
          >
            <RefreshCw />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="印刷・PDF"
            className="max-sm:size-8 max-sm:p-0"
            disabled={
              !data || !rows.length || query.isFetching || query.isError
            }
            onClick={() => {
              flushSync(() => setPrinting(true))
              document.body.classList.add("printing-shift-overview")
              window.print()
            }}
          >
            <Printer />
            <span className="hidden sm:inline">印刷・PDF</span>
          </Button>
          {data?.canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="元に戻す"
                disabled={!draft.canUndo || pending}
                onClick={draft.undo}
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="やり直す"
                disabled={!draft.canRedo || pending}
                onClick={draft.redo}
              >
                <Redo2 />
              </Button>
              <Button
                data-save-shortcut
                variant={draft.dirty ? "default" : "outline"}
                size="sm"
                className="min-w-24"
                disabled={!draft.dirty || pending}
                onClick={() => void draft.save()}
              >
                <Save />
                {pending ? "保存中" : draft.dirty ? "保存" : "保存済み"}
              </Button>
            </>
          )}
        </>
      }
      selection={
        data?.canEdit && (
          <AssignmentSelectionToolbar
            selection={removal}
            details={removable.map((target) => ({
              key: assignmentKey(target),
              name:
                data?.members.find((item) => item.id === target.memberId)
                  ?.displayName ?? "",
              activity:
                data?.activities.find((item) => item.id === target.activityId)
                  ?.name ?? "",
              time: `${japanTime(target.startsAt)}〜${japanTime(target.endsAt)}`,
            }))}
            pending={pending}
            summary={`${selectedMemberIds.length}人選択中`}
            onAssign={() => setBulkMembers(selectedMemberIds)}
            onRemove={() => void removeSelected()}
          />
        )
      }
    >
      <ShiftMemberSearch
        value={filters.search}
        onChange={(search) => change({ search })}
      />
      <FilterMenu
        label="ロール"
        options={(roleOptions.data?.roles ?? data?.roles ?? [])
          .filter(
            (role) =>
              filterValues(filters.roles).includes(role.id) ||
              data?.roles.some((item) => item.id === role.id)
          )
          .map((r) => ({ value: r.id, label: r.name }))}
        value={filters.roles}
        onChange={(roles) => change({ roles })}
      />
      <FilterMenu
        label="シフト"
        options={(activityOptions.data?.activities ?? data?.activities ?? [])
          .filter(
            (activity) =>
              filterValues(filters.activities).includes(activity.id) ||
              data?.activities.some((item) => item.id === activity.id)
          )
          .map((a) => ({ value: a.id, label: a.name }))}
        value={filters.activities}
        onChange={(activities) => change({ activities })}
      />
    </ShiftWorkspaceToolbar>
  )
  return (
    <fieldset
      disabled={pending}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {draft.overwrite && (
        <AssignmentOverwriteDialog
          review={draft.overwrite.review}
          plan={draft.overwrite.plan}
          pending={draft.overwrite.pending}
          onCancel={draft.cancelOverwrite}
          onConfirm={draft.confirmOverwrite}
        />
      )}

      <ManagementViewport viewKey={`shifts:${year}:overview`} width="full">
        <div className="space-y-3">
          {(!data || query.isError) && toolbar}

          {draft.error && (
            <p
              role="alert"
              className="text-sm whitespace-pre-line text-destructive"
            >
              {draft.error} 未保存の変更は残っています。再度保存してください。
            </p>
          )}
          {query.isPending && (
            <output
              aria-label="全体シフトを読み込み中"
              className="block h-10 border-b bg-muted/20"
            />
          )}
          {query.isError && (
            <p role="alert" className="text-sm text-destructive">
              全体シフトを取得できませんでした。更新して再試行してください。
            </p>
          )}
          {data && !query.isError && (
            <>
              <AssignmentSelectionArea selection={removal}>
                <OverviewGrid
                  attendanceColors={attendanceColors.enabled}
                  assignmentSelection={data.canEdit ? removal : undefined}
                  toolbar={toolbar}
                  data={data}
                  rows={rows}
                  date={filters.date}
                  now={now}
                  onSelect={select}
                  onInspect={setAttendance}
                />
              </AssignmentSelectionArea>
              {!rows.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  条件に一致する勤務・メンバーがいません。
                </p>
              )}
              {printing && (
                <section className="overview-print hidden">
                  <h1>シフト表 {filters.date}</h1>
                  <p>
                    ロール：
                    {filterDescription(
                      (roleOptions.data?.roles ?? data.roles).map((role) => ({
                        value: role.id,
                        label: role.name,
                      })),
                      filters.roles
                    )}
                    {" ／ シフト："}
                    {filterDescription(
                      (activityOptions.data?.activities ?? data.activities).map(
                        (activity) => ({
                          value: activity.id,
                          label: activity.name,
                        })
                      ),
                      filters.activities
                    )}
                    {filters.search ? ` ／ 検索：${filters.search}` : ""}
                  </p>
                  <p>
                    出力時点：
                    {new Date(now).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </p>
                  <OverviewGrid
                    printing
                    attendanceColors={attendanceColors.enabled}
                    data={{ ...data, canEdit: false }}
                    rows={rows}
                    date={filters.date}
                    now={now}
                    onSelect={() => {}}
                    onInspect={() => {}}
                  />
                </section>
              )}
              {bulkMembers && data.canEdit && (
                <OverviewBulkAssignment
                  data={data}
                  drafts={draft.drafts}
                  memberIds={bulkMembers}
                  onClose={() => setBulkMembers(null)}
                  onApply={(id, value) => {
                    draft.update(id, value)
                    removal.end()
                  }}
                />
              )}
              {selection && data.canEdit && (
                <OverviewEditor
                  drafts={draft.drafts}
                  onApply={draft.updateMany}
                  selection={selection.value}
                  anchor={selection.anchor}
                  data={data}
                  onClose={() => setSelection(null)}
                />
              )}
              {attendance && (
                <ShiftAttendance
                  activityId={attendance}
                  onClose={() => setAttendance(null)}
                />
              )}
            </>
          )}
        </div>
      </ManagementViewport>
    </fieldset>
  )
}

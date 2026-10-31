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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { flushSync } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Undo2,
  Redo2,
  Save,
  Printer,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { japanDateTime, japanTime } from "@workspace/shared/japan-time"
import { activitiesQuery } from "../data/activities"
import { rolesQuery } from "@/features/years/data/years"
import { overviewQuery } from "../data/overview"
import { ShiftViewToolbar } from "./shift-view-toolbar"

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
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import { useOverviewDraft } from "./use-overview-draft"
import { projectOverview } from "./overview-draft"
import { useOverviewAttendanceColors } from "./use-overview-attendance-colors"
import type { ShiftAnchor } from "./shift-anchor"

export function ShiftOverview({
  year,
  navigation,
}: {
  year: number
  navigation: ReactNode
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
        <ShiftViewToolbar navigation={navigation} />
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
          <p className="py-6 text-sm text-muted-foreground">読み込み中…</p>
        )}
      </div>
    )
  return (
    <ShiftOverviewContent
      year={year}
      navigation={navigation}
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
  navigation,
  initialDate,
}: {
  year: number
  navigation: ReactNode
  initialDate: string
}) {
  const draft = useOverviewDraft()
  const attendanceColors = useOverviewAttendanceColors()
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
    setDirty(
      draft.dirty || pending || selection !== null || bulkMembers !== null
    )
    return () => setDirty(false)
  }, [draft.dirty, pending, selection, bulkMembers, setDirty])
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
  return (
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      {draft.overwrite && (
        <AssignmentOverwriteDialog
          review={draft.overwrite.review}
          plan={draft.overwrite.plan}
          pending={draft.overwrite.pending}
          onCancel={draft.cancelOverwrite}
          onConfirm={draft.confirmOverwrite}
        />
      )}

      <ShiftViewToolbar navigation={navigation}>
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
            <ManagementHeaderActions>
              <Button
                variant="outline"
                size="sm"
                disabled={!draft.dirty || pending}
                onClick={() => void draft.save()}
              >
                <Save />
                {pending
                  ? "保存中"
                  : draft.dirty
                    ? "保存（未保存）"
                    : "保存済み"}
              </Button>
            </ManagementHeaderActions>
          </>
        )}
        <label
          htmlFor="overview-attendance-colors"
          className="flex min-h-8 items-center gap-2 text-sm font-medium"
          title="遅刻：黄、欠勤：赤、出勤：緑、未記録：グレー"
        >
          出勤状況
          <Switch
            id="overview-attendance-colors"
            size="sm"
            checked={attendanceColors.enabled}
            onCheckedChange={attendanceColors.toggle}
          />
        </label>
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
          disabled={!data || !rows.length || query.isFetching || query.isError}
          onClick={() => {
            flushSync(() => setPrinting(true))
            document.body.classList.add("printing-shift-overview")
            window.print()
          }}
        >
          <Printer />
          印刷・PDF
        </Button>
      </ShiftViewToolbar>
      {draft.error && (
        <p
          role="alert"
          className="text-sm whitespace-pre-line text-destructive"
        >
          {draft.error} 未保存の変更は残っています。再度保存してください。
        </p>
      )}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        <label
          htmlFor="overview-member-search"
          className="relative min-w-36 flex-1 sm:max-w-56"
        >
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            id="overview-member-search"
            aria-label="名前・学籍番号で検索"
            placeholder="名前・学籍番号で検索"
            value={filters.search}
            className="pl-9"
            onChange={(e) => change({ search: e.target.value })}
          />
        </label>
        <FilterMenu
          label="ロール"
          options={(roleOptions.data?.roles ?? data?.roles ?? [])
            .filter(
              (role) =>
                filters.roles.values.includes(role.id) ||
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
                filters.activities.values.includes(activity.id) ||
                data?.activities.some((item) => item.id === activity.id)
            )
            .map((a) => ({ value: a.id, label: a.name }))}
          value={filters.activities}
          onChange={(activities) => change({ activities })}
        />
        {data?.canEdit && (
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
        )}
      </div>
      {query.isPending && (
        <p className="py-6 text-sm text-muted-foreground">読み込み中…</p>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          全体シフトを取得できませんでした。更新して再試行してください。
        </p>
      )}
      {data && !query.isError && (
        <>
          {rows.length ? (
            <AssignmentSelectionArea selection={removal}>
              <OverviewGrid
                attendanceColors={attendanceColors.enabled}
                assignmentSelection={data.canEdit ? removal : undefined}
                key={JSON.stringify(filters)}
                data={data}
                rows={rows}
                date={filters.date}
                now={now}
                onSelect={select}
                onInspect={setAttendance}
              />
            </AssignmentSelectionArea>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              条件に一致する勤務・メンバーがいません。
            </p>
          )}
          {printing && (
            <section className="overview-print hidden">
              <h1>シフト表 {filters.date}</h1>
              <p>
                ロール
                {filters.roles.values.length > 0 &&
                filters.roles.mode === "exclude"
                  ? "（含まない）"
                  : ""}
                ：
                {filters.roles.values.length
                  ? data.roles
                      .filter((r) => filters.roles.values.includes(r.id))
                      .map((r) => r.name)
                      .join("・")
                  : "すべて"}{" "}
                ／ シフト
                {filters.activities.values.length > 0 &&
                filters.activities.mode === "exclude"
                  ? "（含まない）"
                  : ""}
                ：
                {filters.activities.values.length
                  ? data.activities
                      .filter((a) => filters.activities.values.includes(a.id))
                      .map((a) => a.name)
                      .join("・")
                  : "すべて"}{" "}
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
    </fieldset>
  )
}

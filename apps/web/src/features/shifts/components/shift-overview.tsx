import { useEffect, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Printer,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { japanDateTime } from "@workspace/shared/japan-time"
import { activitiesQuery } from "../data/activities"
import { overviewQuery } from "../data/overview"
import { ShiftViewToolbar } from "./shift-view-toolbar"
import { ActivityFilterMenu } from "./activity-filter-menu"
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

export function ShiftOverview({
  year,
  navigation,
}: {
  year: number
  navigation: ReactNode
}) {
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
          japanDateTime(new Date()).date
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
  const pickerRef = useRef<HTMLInputElement>(null)
  const view = useShiftView(year)
  const [filters, setFilters] = useState<OverviewFilters>(
    () =>
      view.overview ?? {
        date: initialDate,
        roles: [],
        activities: [],
        search: "",
      }
  )
  const [selection, setSelection] = useState<OverviewSelection | null>(null)
  const [attendance, setAttendance] = useState<string | null>(null)
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
  const data = query.data
  const rows = data ? overviewRows(data, filters) : []
  function change(patch: Partial<OverviewFilters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    view.save({ overview: next })
  }
  return (
    <div className="space-y-4">
      <ShiftViewToolbar navigation={navigation}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="全体シフトを更新"
          disabled={query.isFetching}
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
        <ActivityFilterMenu
          searchable
          label="ロール"
          options={
            data?.roles.map((r) => ({ value: r.id, label: r.name })) ?? []
          }
          value={filters.roles}
          onChange={(roles) => change({ roles })}
        />
        <ActivityFilterMenu
          searchable
          label="シフト"
          options={
            data?.activities.map((a) => ({ value: a.id, label: a.name })) ?? []
          }
          value={filters.activities}
          onChange={(activities) => change({ activities })}
        />
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
            <OverviewGrid
              key={`${filters.date}:${filters.roles.join(",")}:${filters.activities.join(",")}:${filters.search}`}
              data={data}
              rows={rows}
              date={filters.date}
              now={now}
              onSelect={setSelection}
              onInspect={setAttendance}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              条件に一致する勤務・メンバーがいません。
            </p>
          )}
          {printing && (
            <section className="overview-print hidden">
              <h1>シフト表 {filters.date}</h1>
              <p>
                ロール：
                {filters.roles.length
                  ? data.roles
                      .filter((r) => filters.roles.includes(r.id))
                      .map((r) => r.name)
                      .join("・")
                  : "すべて"}{" "}
                ／ シフト：
                {filters.activities.length
                  ? data.activities
                      .filter((a) => filters.activities.includes(a.id))
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
                data={{ ...data, canEdit: false }}
                rows={rows}
                date={filters.date}
                now={now}
                onSelect={() => {}}
                onInspect={() => {}}
              />
            </section>
          )}
          {selection && data.canEdit && (
            <OverviewEditor
              selection={selection}
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
  )
}

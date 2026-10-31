import { filterActivities } from "../activity-filters"
import { useShiftView } from "../shift-view-context"
import { FilterMenu } from "@workspace/ui/components/filter-menu"
import { emptyFilter, type FilterValue } from "@workspace/ui/lib/filters"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { activitiesQuery } from "@/features/shifts/data/activities"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  japanTime,
  japanDateTime,
  japanDateWeekday,
} from "@workspace/shared/japan-time"

const columns =
  "@md:grid-cols-[6.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.5rem] @xl:grid-cols-[8rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.5rem] @4xl:grid-cols-[11rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.5rem]"

export function ActivityManager({
  year,
  view,
}: {
  year: number
  view: {
    search: string
    filter: string
    filters?: Record<string, FilterValue>
    save: (
      patch: Partial<{
        search: string
        filter: string
        filters: Record<string, FilterValue>
      }>
    ) => void
  }
}) {
  const query = useQuery(activitiesQuery(year))
  const [search, setSearch] = useState(() => view.search)
  const [status, setStatus] = useState(
    () => view.filters?.status ?? emptyFilter()
  )
  const activities = query.data?.activities ?? []
  const shiftView = useShiftView(year)
  const [filters, setFilters] = useState(
    () =>
      shiftView.listFilters ?? {
        dates: emptyFilter(),
        responsibles: emptyFilter(),
        places: emptyFilter(),
      }
  )
  const visible = filterActivities(activities, filters, search, status)
  const dates = [
    ...new Set(activities.map((item) => japanDateTime(item.startsAt).date)),
  ].sort()
  const responsibles = [
    ...new Set(activities.flatMap((item) => item.responsibleNames)),
  ].sort((a, b) => a.localeCompare(b, "ja"))
  const places = [...new Set(activities.map((item) => item.place))].sort(
    (a, b) => a.localeCompare(b, "ja")
  )
  return (
    <div>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background py-4">
        <Input
          aria-label="シフトを検索"
          placeholder="シフト名・担当・場所で検索"
          className="w-full sm:max-w-80"
          value={search}
          onChange={(event) => {
            view.save({ search: event.target.value })
            setSearch(event.target.value)
          }}
        />
        {(
          [
            {
              key: "dates",
              label: "日付",
              options: dates.map((date) => ({
                value: date,
                label: japanDateWeekday(`${date}T12:00:00+09:00`),
              })),
            },
            {
              key: "responsibles",
              label: "担当",
              options: responsibles.map((name) => ({
                value: name,
                label: name,
              })),
            },
            {
              key: "places",
              label: "場所",
              options: places.map((place) => ({
                value: place,
                label: place || "未設定",
              })),
            },
          ] as const
        ).map(({ key, label, options }) => (
          <FilterMenu
            key={key}
            label={label}
            options={options}
            value={filters[key]}
            onChange={(value) => {
              const next = { ...filters, [key]: value }
              setFilters(next)
              shiftView.save({ listFilters: next })
            }}
          />
        ))}
        <FilterMenu
          label="状態"
          searchable={false}
          value={status}
          onChange={(value) => {
            setStatus(value)
            view.save({ filters: { status: value } })
          }}
          options={[
            { value: "active", label: "有効" },
            { value: "inactive", label: "無効" },
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/manage/shifts/availability" />}
          >
            シフト希望フォーム
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/manage/shifts/new" />}
          >
            シフトを作成
          </Button>
        </div>
      </div>
      {query.isError && (
        <p role="alert" className="py-4">
          シフトを取得できませんでした。
          <Button
            size="sm"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            再試行
          </Button>
        </p>
      )}
      <div className="@container min-w-0 border-b">
        <div
          className={`hidden grid-cols-1 gap-3 border-b px-2 py-2 text-xs text-muted-foreground @md:grid ${columns}`}
        >
          <span>日時</span>
          <span>シフト</span>
          <span>担当</span>
          <span>場所</span>
          <span>状態</span>
        </div>
        <ul className="divide-y">
          {visible.map((item) => (
            <li key={item.id}>
              <Link
                to="/manage/shifts/$shiftId"
                params={{ shiftId: item.id }}
                preload="intent"
                className={`block min-w-0 space-y-1 px-2 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring @md:grid @md:min-h-11 @md:items-center @md:gap-3 @md:space-y-0 @md:py-2 ${columns}`}
              >
                <span className="block text-xs text-muted-foreground tabular-nums @md:text-sm @md:text-foreground">
                  {japanDateWeekday(item.startsAt)}
                  <br />
                  {japanTime(item.startsAt)}–{japanTime(item.endsAt)}
                </span>
                <span
                  className="block min-w-0 text-sm font-medium break-words @md:truncate"
                  title={item.name}
                >
                  {item.name}
                </span>
                <span
                  className="block min-w-0 text-xs break-words text-muted-foreground @md:truncate"
                  title={item.responsibleNames.join("、")}
                >
                  <span className="@md:hidden">担当：</span>
                  {item.responsibleNames.join("、") || "—"}
                </span>
                <span
                  className="block min-w-0 text-xs break-words text-muted-foreground @md:truncate"
                  title={item.place}
                >
                  <span className="@md:hidden">場所：</span>
                  {item.place || "—"}
                </span>
                <span
                  className={`block text-xs ${item.active ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}
                >
                  {item.active ? "有効" : "無効"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {query.data && visible.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">
          {activities.length === 0
            ? "この年度にはシフトがありません。"
            : "条件に一致するシフトがありません。"}
        </p>
      )}
    </div>
  )
}

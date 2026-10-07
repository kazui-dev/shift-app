import { filterActivities } from "../activity-filters"
import { useShiftView } from "../shift-view-context"
import { ActivityFilterMenu } from "./activity-filter-menu"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { activitiesQuery } from "@/features/shifts/data/activities"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { SelectField } from "@/components/select-field"
import {
  japanTime,
  japanDateTime,
  japanDateWeekday,
} from "@workspace/shared/japan-time"

const columns =
  "@4xl:grid-cols-[11rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.5rem]"

export function ActivityManager({
  year,
  view,
}: {
  year: number
  view: {
    search: string
    filter: string
    save: (patch: Partial<{ search: string; filter: string }>) => void
  }
}) {
  const query = useQuery(activitiesQuery(year))
  const [search, setSearch] = useState(() => view.search)
  const [status, setStatus] = useState(() => view.filter || "all")
  const activities = query.data?.activities ?? []
  const shiftView = useShiftView(year)
  const [filters, setFilters] = useState(
    () => shiftView.listFilters ?? { dates: [], responsibles: [], places: [] }
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
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background py-4">
        <Input
          aria-label="シフトを検索"
          placeholder="シフト名・担当・場所で検索"
          className="h-9 w-full sm:max-w-80"
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
          <ActivityFilterMenu
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
        <SelectField
          aria-label="シフトの状態"
          className="h-9 w-auto"
          value={status}
          onValueChange={(value) => {
            view.save({ filter: value })
            setStatus(value)
          }}
          options={[
            { value: "all", label: "すべての状態" },
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
        <p role="alert">
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
      <div className="@container min-w-0 border-y">
        <div
          className={`hidden grid-cols-1 gap-3 border-b px-2 py-2 text-xs text-muted-foreground @4xl:grid ${columns}`}
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
                className={`block min-w-0 space-y-1 px-2 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring @4xl:grid @4xl:min-h-11 @4xl:items-center @4xl:gap-3 @4xl:space-y-0 @4xl:py-2 ${columns}`}
              >
                <span className="block text-xs text-muted-foreground tabular-nums @4xl:text-sm @4xl:text-foreground">
                  {japanDateWeekday(item.startsAt)}
                  <br />
                  {japanTime(item.startsAt)}–{japanTime(item.endsAt)}
                </span>
                <span
                  className="block min-w-0 text-sm font-medium break-words @4xl:truncate"
                  title={item.name}
                >
                  {item.name}
                </span>
                <span
                  className="block min-w-0 text-xs break-words text-muted-foreground @4xl:truncate"
                  title={item.responsibleNames.join("、")}
                >
                  <span className="@4xl:hidden">担当：</span>
                  {item.responsibleNames.join("、") || "—"}
                </span>
                <span
                  className="block min-w-0 text-xs break-words text-muted-foreground @4xl:truncate"
                  title={item.place}
                >
                  <span className="@4xl:hidden">場所：</span>
                  {item.place || "—"}
                </span>
                <span className="block text-xs text-muted-foreground">
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

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { activitiesQuery } from "@/features/shifts/data/activities"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { SelectField } from "@/components/select-field"
import {
  japanTime,
  japanDateTime,
  japanDateWeekday,
} from "@workspace/shared/japan-time"

function requirementLabel(activity: {
  requirements: { startsAt: string; endsAt: string; requiredCount: number }[]
}) {
  return activity.requirements
    .map(
      (item) =>
        `${japanTime(item.startsAt)}–${japanTime(item.endsAt)} ${item.requiredCount}人`
    )
    .join(" / ")
}

export function ActivityManager({
  year,
  view,
}: {
  year: number
  view: { search: string; filter: string }
}) {
  const query = useQuery(activitiesQuery(year))
  const [search, setSearch] = useState(() => view.search)
  const [status, setStatus] = useState(() => view.filter || "all")
  const activities = query.data?.activities ?? []
  const visible = activities.filter(
    (item) =>
      (status === "all" || item.active === (status === "active")) &&
      `${item.name} ${item.responsibleNames.join(" ")} ${item.place}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )
  const dates = [
    ...new Set(visible.map((item) => japanDateTime(item.startsAt).date)),
  ].sort()
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background py-4">
        <Input
          aria-label="シフトを検索"
          placeholder="シフト名・担当・場所で検索"
          className="h-9 w-full sm:max-w-80"
          value={search}
          onChange={(event) => {
            view.search = event.target.value
            setSearch(event.target.value)
          }}
        />
        <SelectField
          aria-label="シフトの状態"
          className="h-9 w-auto"
          value={status}
          onValueChange={(value) => {
            view.filter = value
            setStatus(value)
          }}
          options={[
            { value: "all", label: "すべて" },
            { value: "active", label: "有効" },
            { value: "inactive", label: "無効" },
          ]}
        />
        <Link
          className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto shrink-0`}
          to="/manage/shifts/availability"
        >
          シフト希望フォーム
        </Link>
        <Link
          className={buttonVariants({ variant: "outline", size: "sm" })}
          to="/manage/shifts/new"
        >
          シフトを作成
        </Link>
      </div>
      {query.isError && (
        <p role="alert">
          シフトを取得できませんでした。
          <Button variant="ghost" onClick={() => void query.refetch()}>
            再試行
          </Button>
        </p>
      )}
      {dates.map((date) => {
        const items = visible.filter(
          (item) => japanDateTime(item.startsAt).date === date
        )
        return (
          items.length > 0 && (
            <details key={date} open className="group">
              <summary className="mb-2 cursor-pointer text-sm font-medium marker:text-muted-foreground">
                {japanDateWeekday(`${date}T12:00:00+09:00`)}
              </summary>
              <div className="overflow-x-auto border-y">
                <div className="grid min-w-[76rem] grid-cols-[6rem_minmax(12rem,1fr)_12rem_9rem_24rem_3rem] gap-4 border-b px-2 py-2 text-xs text-muted-foreground">
                  <span>時間</span>
                  <span>シフト</span>
                  <span>担当</span>
                  <span>場所</span>
                  <span>必要人数</span>
                  <span>状態</span>
                </div>
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link
                        to="/manage/shifts/$shiftId"
                        params={{ shiftId: item.id }}
                        preload="intent"
                        className="grid min-h-11 min-w-[76rem] grid-cols-[6rem_minmax(12rem,1fr)_12rem_9rem_24rem_3rem] items-center gap-4 px-2 py-2 hover:bg-muted/50"
                      >
                        <span className="text-sm tabular-nums">
                          {japanTime(item.startsAt)}–{japanTime(item.endsAt)}
                        </span>
                        <span
                          className="min-w-0 truncate text-sm font-medium"
                          title={item.name}
                        >
                          {item.name}
                        </span>
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={item.responsibleNames.join("、")}
                        >
                          {item.responsibleNames.join("、")}
                        </span>
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={item.place}
                        >
                          {item.place || "—"}
                        </span>
                        <span
                          className="truncate text-xs whitespace-nowrap text-muted-foreground"
                          title={requirementLabel(item)}
                        >
                          {requirementLabel(item)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.active ? "" : "無効"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )
        )
      })}
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

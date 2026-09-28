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
      `${item.name} ${item.place ?? ""}`
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
          placeholder="シフト名・場所で検索"
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
            <section key={date}>
              <h2 className="mb-2 text-sm font-medium">
                {japanDateWeekday(`${date}T12:00:00+09:00`)}
              </h2>
              <ul className="divide-y border-y">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to="/manage/shifts/$shiftId"
                      params={{ shiftId: item.id }}
                      preload="intent"
                      className="flex min-h-16 items-center gap-4 px-2 py-3 hover:bg-muted/50"
                    >
                      <span className="w-28 shrink-0 text-sm tabular-nums">
                        {japanTime(item.startsAt)}–{japanTime(item.endsAt)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {item.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.place}
                        </span>
                      </span>
                      {!item.active && (
                        <span className="text-xs text-muted-foreground">
                          無効
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
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

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
import { CreateShift } from "./create-shift"

export function ActivityManager({ year }: { year: number }) {
  const query = useQuery(activitiesQuery(year))
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [creating, setCreating] = useState(false)
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label="シフトを検索"
              placeholder="シフト名・場所で検索"
              className="w-full sm:max-w-80"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <SelectField
              aria-label="シフトの状態"
              className="w-auto"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "すべて" },
                { value: "active", label: "有効" },
                { value: "inactive", label: "無効" },
              ]}
            />
            <Button
              className="ml-auto shrink-0"
              variant="outline"
              onClick={() => setCreating(true)}
            >
              シフトを作成
            </Button>
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
                          state={{ managementParent: "/manage/shifts" }}
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
      </div>
      <CreateShift
        year={year}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </div>
  )
}

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { errorMessage } from "@/lib/api"
import { getAnnouncements } from "@/lib/communications-api"
import { getYears } from "@/lib/shifts-api"

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function NoticesPage() {
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const availableYears = useMemo(
    () => years.data?.years.filter((year) => year.status !== "archived") ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? availableYears[0]?.year ?? null
  const announcements = useQuery({
    queryKey: ["announcements", year],
    queryFn: () => getAnnouncements(year!),
    enabled: year !== null,
  })

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">委員会からのお知らせ</p>
          <h1 className="text-xl font-medium">連絡</h1>
        </div>
        {availableYears.length > 1 && (
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {availableYears.map((item) => (
              <option key={item.year} value={item.year}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {years.isPending || announcements.isPending ? (
        <LoaderCircle className="animate-spin" />
      ) : announcements.isError ? (
        <p className="text-destructive">{errorMessage(announcements.error)}</p>
      ) : announcements.data?.announcements.length === 0 ? (
        <p className="rounded-lg border p-4 text-muted-foreground">
          現在のお知らせはありません。
        </p>
      ) : (
        <ul className="space-y-3">
          {announcements.data?.announcements.map((announcement) => (
            <li
              key={announcement.id}
              className={`rounded-lg border p-4 ${announcement.priority === "important" ? "border-destructive" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium">{announcement.title}</h2>
                {announcement.priority === "important" && (
                  <span className="text-xs text-destructive">重要</span>
                )}
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">
                {announcement.body}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {announcement.authorDisplayName} ·{" "}
                {dateTime(announcement.publishedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

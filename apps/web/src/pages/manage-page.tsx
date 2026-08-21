import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { getYears } from "@/api/years"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AnnouncementManager } from "@/components/manage/announcement-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { ReportManager } from "@/components/manage/report-manager"

export function ManagePage() {
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const manageableYears = useMemo(
    () => years.data?.years.filter((year) => year.canManage) ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? manageableYears[0]?.year ?? null

  if (years.isPending) return <LoaderCircle className="animate-spin" />
  if (year === null) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-medium">シフト管理</h1>
        <p className="rounded-lg border p-4 text-muted-foreground">
          シフトを管理できる年度がありません。
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">希望と割当</p>
          <h1 className="text-xl font-medium">シフト管理</h1>
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={year}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
        >
          {manageableYears.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}
            </option>
          ))}
        </select>
      </div>

      <ActivityManager key={year} year={year} />
      <AvailabilitySummary year={year} />
      <ReportManager year={year} />
      <AnnouncementManager year={year} />
    </section>
  )
}

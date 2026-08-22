import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getYears } from "@/api/years"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { ReportManager } from "@/components/manage/report-manager"
import { fieldClassName } from "@/components/form-styles"
import { EmptyState, LoadingState, PageHeader } from "@/components/page-layout"

export function ManagePage() {
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const manageableYears = useMemo(
    () => years.data?.years.filter((year) => year.canManage) ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? manageableYears[0]?.year ?? null

  if (years.isPending) return <LoadingState />
  if (year === null) {
    return (
      <section className="space-y-6">
        <PageHeader title="シフト管理" />
        <EmptyState>管理できる年度がありません</EmptyState>
      </section>
    )
  }

  return (
    <section className="space-y-10">
      <PageHeader title="シフト管理">
        <select
          aria-label="年度"
          className={`${fieldClassName} w-auto`}
          value={year}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
        >
          {manageableYears.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}年度
            </option>
          ))}
        </select>
      </PageHeader>

      <ActivityManager key={year} year={year} />
      <AvailabilitySummary year={year} />
      <ReportManager year={year} />
    </section>
  )
}

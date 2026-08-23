import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  KeyRound,
  Users,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { getYears } from "@/api/years"
import { AdminPanel } from "@/components/admin-panel"
import { fieldClassName } from "@/components/form-styles"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { ReportManager } from "@/components/manage/report-manager"
import { EmptyState, LoadingState, PageHeader } from "@/components/page-layout"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"

const routeApi = getRouteApi("/_app")

type ManageView =
  | "home"
  | "shifts"
  | "reports"
  | "availability"
  | "organization"
  | "accounts"

const viewTitles: Record<Exclude<ManageView, "home">, string> = {
  shifts: "シフト",
  reports: "遅刻・欠勤連絡",
  availability: "シフト希望状況",
  organization: "年度・メンバー・権限",
  accounts: "アカウント管理",
}

export function ManagePage() {
  const { state } = routeApi.useRouteContext()
  const systemAdmin = state.member.accessLevel === "system_admin"
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const manageableYears = useMemo(
    () => years.data?.years.filter((year) => year.canManage) ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [view, setView] = useState<ManageView>("home")
  const year = selectedYear ?? manageableYears[0]?.year ?? null

  if (years.isPending) return <LoadingState />
  if (year === null && !systemAdmin) {
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="管理" />
        <EmptyState>管理できる年度がありません</EmptyState>
      </section>
    )
  }

  if (view === "home") {
    const items = [
      {
        view: "shifts" as const,
        label: "シフト",
        description: "活動と担当者を編集",
        icon: CalendarClock,
        visible: year !== null,
      },
      {
        view: "reports" as const,
        label: "遅刻・欠勤連絡",
        description: "未対応の連絡を確認",
        icon: CircleAlert,
        visible: year !== null,
      },
      {
        view: "availability" as const,
        label: "シフト希望状況",
        description: "提出状況を確認",
        icon: ClipboardCheck,
        visible: year !== null,
      },
      {
        view: "organization" as const,
        label: "年度・メンバー・権限",
        description: "年度の運用と権限を管理",
        icon: Users,
        visible: systemAdmin,
      },
      {
        view: "accounts" as const,
        label: "アカウント管理",
        description: "利用者と連携申請を管理",
        icon: KeyRound,
        visible: systemAdmin,
      },
    ]

    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="管理">
          {manageableYears.length > 1 && (
            <select
              aria-label="年度"
              className={`${fieldClassName} w-auto`}
              value={year ?? ""}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {manageableYears.map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}年度
                </option>
              ))}
            </select>
          )}
        </PageHeader>
        <ul className="divide-y border-y">
          {items
            .filter((item) => item.visible)
            .map(({ view: nextView, label, description, icon: Icon }) => (
              <li key={nextView}>
                <button
                  type="button"
                  className="flex min-h-17 w-full items-center gap-3 py-3 text-left"
                  onClick={() => setView(nextView)}
                >
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
        </ul>
      </section>
    )
  }

  const yearScoped =
    view === "shifts" || view === "reports" || view === "availability"

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={viewTitles[view]}>
        {yearScoped && manageableYears.length > 1 && (
          <select
            aria-label="年度"
            className={`${fieldClassName} w-auto`}
            value={year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {manageableYears.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year}年度
              </option>
            ))}
          </select>
        )}
      </PageHeader>
      <Button variant="ghost" size="sm" onClick={() => setView("home")}>
        <ArrowLeft />
        管理に戻る
      </Button>

      {view === "shifts" && year !== null && (
        <ActivityManager key={year} year={year} />
      )}
      {view === "reports" && year !== null && <ReportManager year={year} />}
      {view === "availability" && year !== null && (
        <AvailabilitySummary year={year} />
      )}
      {view === "organization" && <YearSettingsPanel />}
      {view === "accounts" && <AdminPanel />}
    </section>
  )
}

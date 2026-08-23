import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi, Link } from "@tanstack/react-router"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { getYears } from "@/api/years"
import {
  AuditLogManager,
  DiscordLinkRequestManager,
} from "@/components/admin-panel"
import { fieldClassName } from "@/components/form-styles"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { ReportManager } from "@/components/manage/report-manager"
import {
  EmptyState,
  PageBreadcrumb,
  PageHeader,
} from "@/components/page-layout"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"
import { MemberManager } from "@/components/system/member-manager"
import { YearRoleManager } from "@/components/system/year-role-manager"

const routeApi = getRouteApi("/_app")

type ManageView =
  | "home"
  | "shifts"
  | "reports"
  | "availability"
  | "years"
  | "members"
  | "roles"
  | "discordLinks"
  | "audit"

const viewTitles: Record<Exclude<ManageView, "home">, string> = {
  shifts: "シフト",
  reports: "遅刻・欠勤連絡",
  availability: "シフト希望",
  years: "年度",
  members: "メンバー",
  roles: "ロール",
  discordLinks: "Discord連携申請",
  audit: "操作履歴",
}

export function ManagePage({ view }: { view: ManageView }) {
  const { state } = routeApi.useRouteContext()
  const systemAdmin = state.member.accessLevel === "system_admin"
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const manageableYears = useMemo(
    () => years.data?.years.filter((year) => year.canManage) ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedSystemYear, setSelectedSystemYear] = useState<number | null>(
    null
  )
  const year = selectedYear ?? manageableYears[0]?.year ?? null
  const systemYear = selectedSystemYear ?? years.data?.years[0]?.year ?? null

  if (!years.isPending && year === null && !systemAdmin) {
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="管理" />
        <EmptyState>管理できる年度がありません</EmptyState>
      </section>
    )
  }

  if (view === "home") {
    const shiftItems = [
      {
        to: "/manage/shifts" as const,
        label: "シフト",
        visible: year !== null,
      },
      {
        to: "/manage/reports" as const,
        label: "遅刻・欠勤連絡",
        visible: year !== null,
      },
      {
        to: "/manage/availability" as const,
        label: "シフト希望",
        visible: year !== null,
      },
    ]
    const systemItems = [
      {
        to: "/manage/years" as const,
        label: "年度",
      },
      {
        to: "/manage/members" as const,
        label: "メンバー",
      },
      {
        to: "/manage/roles" as const,
        label: "ロール",
      },
      {
        to: "/manage/discord-link-requests" as const,
        label: "Discord連携申請",
      },
      {
        to: "/manage/audit" as const,
        label: "操作履歴",
      },
    ]
    const items = [
      ...shiftItems.filter((item) => item.visible),
      ...(systemAdmin ? systemItems : []),
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
        {!years.isPending && (
          <ul className="divide-y border-y">
            {items.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex min-h-14 items-center justify-between gap-3 py-3 font-medium"
                >
                  {label}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  const yearScoped =
    view === "shifts" || view === "reports" || view === "availability"
  const systemYearScoped = view === "members" || view === "roles"

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageBreadcrumb>
        <Button
          render={<Link to="/manage" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft />
          管理
        </Button>
      </PageBreadcrumb>
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
        {systemYearScoped && years.data && years.data.years.length > 1 && (
          <select
            aria-label="年度"
            className={`${fieldClassName} w-auto`}
            value={systemYear ?? ""}
            onChange={(event) =>
              setSelectedSystemYear(Number(event.target.value))
            }
          >
            {years.data.years.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year}年度
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      {view === "shifts" && year !== null && (
        <ActivityManager key={year} year={year} />
      )}
      {view === "reports" && year !== null && <ReportManager year={year} />}
      {view === "availability" && year !== null && (
        <AvailabilitySummary year={year} />
      )}
      {view === "years" && <YearSettingsPanel />}
      {view === "members" && systemYear !== null && (
        <MemberManager key={systemYear} year={systemYear} />
      )}
      {view === "roles" && systemYear !== null && (
        <YearRoleManager key={systemYear} year={systemYear} />
      )}
      {view === "discordLinks" && <DiscordLinkRequestManager />}
      {view === "audit" && <AuditLogManager />}
    </section>
  )
}

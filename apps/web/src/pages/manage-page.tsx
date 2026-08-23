import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi, Link } from "@tanstack/react-router"
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  History,
  Link as LinkIcon,
  Tags,
  Users,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { getYears } from "@/api/years"
import {
  AuditLogManager,
  DiscordLinkRequestManager,
} from "@/components/admin-panel"
import { nativeSelectClassName } from "@/components/form-styles"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { ReportManager } from "@/components/manage/report-manager"
import { EmptyState, PageHeader } from "@/components/page-layout"
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
        name: "シフト",
        icon: CalendarClock,
      },
      {
        to: "/manage/reports" as const,
        name: "遅刻・欠勤連絡",
        icon: CircleAlert,
      },
      {
        to: "/manage/availability" as const,
        name: "シフト希望",
        icon: ClipboardCheck,
      },
    ]
    const systemItems = [
      {
        to: "/manage/years" as const,
        name: "年度",
        icon: CalendarClock,
      },
      {
        to: "/manage/members" as const,
        name: "メンバー",
        icon: Users,
      },
      {
        to: "/manage/roles" as const,
        name: "ロール",
        icon: Tags,
      },
      {
        to: "/manage/discord-link-requests" as const,
        name: "Discord連携申請",
        icon: LinkIcon,
      },
      {
        to: "/manage/audit" as const,
        name: "操作履歴",
        icon: History,
      },
    ]

    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="管理">
          {manageableYears.length > 1 && (
            <select
              aria-label="年度"
              className={`${nativeSelectClassName} w-auto`}
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
          <div className="space-y-6">
            {year !== null && (
              <section>
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                  シフト管理
                </h2>
                <ul className="divide-y border-y">
                  {shiftItems.map(({ to, name, icon: Icon }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="flex min-h-14 items-center gap-3 py-3 font-medium"
                      >
                        <Icon className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">{name}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {systemAdmin && (
              <section>
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                  システム管理
                </h2>
                <ul className="divide-y border-y">
                  {systemItems.map(({ to, name, icon: Icon }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="flex min-h-14 items-center gap-3 py-3 font-medium"
                      >
                        <Icon className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">{name}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </section>
    )
  }

  const yearScoped =
    view === "shifts" || view === "reports" || view === "availability"
  const systemYearScoped = view === "members" || view === "roles"

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={viewTitles[view]}
        back={
          <Button
            className="-ml-2"
            render={<Link to="/manage" />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            aria-label="管理に戻る"
          >
            <ChevronLeft />
          </Button>
        }
      >
        {yearScoped && manageableYears.length > 1 && (
          <select
            aria-label="年度"
            className={`${nativeSelectClassName} w-auto`}
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
            className={`${nativeSelectClassName} w-auto`}
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

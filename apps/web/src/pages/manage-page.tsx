import { cn } from "@workspace/ui/lib/utils"
import { UserManager } from "@/components/system/user-manager"
import { useManagementYear } from "@/components/use-management-year"
import { getRouteApi, Link } from "@tanstack/react-router"
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  Link as LinkIcon,
  Tags,
  Users,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import {
  AuditLogManager,
  DiscordLinkRequestManager,
} from "@/components/admin-panel"
import { nativeSelectClassName } from "@/components/form-styles"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { EmptyState, PageHeader } from "@/components/page-layout"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"
import { MemberManager } from "@/components/system/member-manager"
import { YearRoleManager } from "@/components/system/year-role-manager"

const routeApi = getRouteApi("/_app")

type ManageView =
  | "home"
  | "shifts"
  | "availability"
  | "years"
  | "users"
  | "members"
  | "roles"
  | "discordLinks"
  | "audit"

const viewTitles: Record<Exclude<ManageView, "home">, string> = {
  shifts: "シフト",
  availability: "シフト希望",
  years: "年度",
  members: "メンバー",
  users: "ユーザー",
  roles: "ロール",
  discordLinks: "Discord連携申請",
  audit: "操作履歴",
}

export function ManagePage({ view }: { view: ManageView }) {
  const { state } = routeApi.useRouteContext()
  const systemAdmin = state.member.accessLevel === "system_admin"
  const years = useManagementYear()
  const manageableYears = years.years
  const year = years.year
  const setSelectedYear = years.selectYear

  if (!years.isPending && year === null && !systemAdmin) {
    return (
      <section className="w-full min-w-0 space-y-6">
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
        to: "/manage/members" as const,
        name: "メンバー",
        icon: Users,
      },
      { to: "/manage/roles" as const, name: "ロール", icon: Tags },
    ]
    const systemItems = [
      {
        to: "/manage/years" as const,
        name: "年度",
        icon: CalendarClock,
      },
      { to: "/manage/users" as const, name: "ユーザー", icon: Users },
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
      <section className="w-full min-w-0 space-y-6 pt-3">
        {!years.isPending && (
          <div className="space-y-6">
            {year !== null && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-xs font-medium text-muted-foreground">
                    管理
                  </h2>
                  {manageableYears.length > 1 && (
                    <select
                      aria-label="年度"
                      className={cn(nativeSelectClassName, "w-auto")}
                      value={year ?? ""}
                      onChange={(event) =>
                        setSelectedYear(Number(event.target.value))
                      }
                    >
                      {manageableYears.map((item) => (
                        <option key={item.year} value={item.year}>
                          {item.year}年度
                        </option>
                      ))}
                    </select>
                  )}
                  {manageableYears.length === 1 && (
                    <span className="text-xs text-muted-foreground">
                      {year}年度
                    </span>
                  )}
                </div>
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
    view === "shifts" ||
    view === "availability" ||
    view === "members" ||
    view === "roles"

  return (
    <section className="w-full min-w-0 space-y-6">
      <PageHeader
        title={viewTitles[view]}
        back={
          <Button
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
        {yearScoped && manageableYears.length === 1 && (
          <span className="text-sm text-muted-foreground">{year}</span>
        )}
        {yearScoped && manageableYears.length > 1 && (
          <select
            aria-label="年度"
            className={cn(nativeSelectClassName, "w-auto")}
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

      {view === "shifts" && year !== null && (
        <ActivityManager key={year} year={year} />
      )}
      {view === "availability" && year !== null && (
        <AvailabilitySummary year={year} />
      )}
      {view === "users" && <UserManager />}
      {view === "years" && <YearSettingsPanel />}
      {view === "members" && year !== null && (
        <MemberManager key={year} year={year} />
      )}
      {view === "roles" && year !== null && (
        <YearRoleManager key={year} year={year} />
      )}
      {view === "discordLinks" && <DiscordLinkRequestManager />}
      {view === "audit" && <AuditLogManager />}
    </section>
  )
}

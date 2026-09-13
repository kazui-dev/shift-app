import { UserManager } from "@/components/system/user-manager"
import { useManagementYear } from "@/components/use-management-year"
import { getRouteApi, Link, Outlet, useNavigate } from "@tanstack/react-router"
import {
  CalendarClock,
  ChevronRight,
  History,
  Link as LinkIcon,
  Tags,
  Users,
} from "lucide-react"

import {
  AuditLogManager,
  DiscordLinkRequestManager,
} from "@/components/admin-panel"
import { SelectField } from "@/components/select-field"
import { ActivityManager } from "@/components/manage/activity-manager"
import { AvailabilitySummary } from "@/components/manage/availability-summary"
import { EmptyState } from "@/components/page-layout"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"
import { MemberManager } from "@/components/system/member-manager"
import { YearRoleManager } from "@/components/system/year-role-manager"

import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { RoutePage } from "@/components/route-page"

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
  const navigate = useNavigate()
  const close = () =>
    void navigate({
      to: view === "availability" ? "/manage/shifts" : "/manage",
      replace: true,
    })
  const { state } = routeApi.useRouteContext()
  const systemAdmin = state.member.accessLevel === "system_admin"
  const years = useManagementYear()
  const manageableYears = years.years
  const year = years.year
  const setSelectedYear = years.selectYear

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
      <section className="w-full min-w-0 space-y-6 py-6">
        {!years.isPending && (
          <div className="space-y-6">
            {year !== null && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-3 px-4 sm:px-6">
                  <h2 className="text-xs font-medium text-muted-foreground">
                    管理
                  </h2>
                  {manageableYears.length > 1 && (
                    <SelectField
                      aria-label="年度"
                      className="w-auto"
                      value={year ?? ""}
                      onValueChange={(value) => setSelectedYear(Number(value))}
                      options={manageableYears.map((item) => ({
                        value: item.year,
                        label: `${item.year}年度`,
                      }))}
                    />
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
                        className="flex min-h-14 items-center gap-3 px-4 py-3 font-medium sm:px-6"
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
                <h2 className="mb-2 px-4 text-xs font-medium text-muted-foreground sm:px-6">
                  システム管理
                </h2>
                <ul className="divide-y border-y">
                  {systemItems.map(({ to, name, icon: Icon }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="flex min-h-14 items-center gap-3 px-4 py-3 font-medium sm:px-6"
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
    <div className="fixed inset-0 z-40 md:contents">
      <RoutePage
        onClose={close}
        desktop={view === "shifts" ? "page" : "dialog"}
      >
        <ResponsivePageHeader title={viewTitles[view]} onBack={close} />
        <ResponsivePageBody>
          <div className="space-y-6">
            {yearScoped && (
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">年度</span>
                {manageableYears.length > 1 ? (
                  <SelectField
                    aria-label="年度"
                    className="w-auto"
                    value={year ?? ""}
                    onValueChange={(value) => setSelectedYear(Number(value))}
                    options={manageableYears.map((item) => ({
                      value: item.year,
                      label: `${item.year}年度`,
                    }))}
                  />
                ) : (
                  <span>{year ?? "—"}年度</span>
                )}
              </div>
            )}
            {yearScoped && year === null && (
              <EmptyState>管理できる年度がありません</EmptyState>
            )}
            {view === "shifts" && year !== null && (
              <ActivityManager key={year} year={year} />
            )}
            {view === "availability" && year !== null && (
              <AvailabilitySummary key={year} year={year} />
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
          </div>
        </ResponsivePageBody>
        <Outlet />
      </RoutePage>
    </div>
  )
}

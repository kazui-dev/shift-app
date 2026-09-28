import { EmptyState } from "@/app/page-layout"
import { Link } from "@tanstack/react-router"
import { UserManager } from "@/features/admin/components/user-manager"
import {
  AuditLogManager,
  DiscordLinkRequestManager,
} from "@/features/admin/components/admin-panel"
import { AvailabilitySummary } from "@/features/availability/components/availability-summary"
import { YearSettingsPanel } from "@/features/years/components/year-settings-panel"
import { MemberManager } from "@/features/members/components/member-manager"
import { YearRoleManager } from "@/features/roles/components/year-role-manager"
import { useManagement, useManagementScreenView } from "../management-context"
import { ManagementPageFrame } from "./page-frame"

export function ManagementAvailabilityPage() {
  const {
    years: { year },
    setDirty,
  } = useManagement()
  return (
    <ManagementPageFrame
      title="シフト希望フォーム"
      viewKey={`availability:${year}`}
      headerLeading={
        <Link
          to="/manage/shifts"
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          ← シフト一覧
        </Link>
      }
    >
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <AvailabilitySummary key={year} year={year} onDirtyChange={setDirty} />
      )}
    </ManagementPageFrame>
  )
}

export function MembersPage() {
  const {
    years: { year },
    setDirty,
  } = useManagement()
  const view = useManagementScreenView(`members:${year}`)
  return (
    <ManagementPageFrame title="メンバー" viewKey={`members:${year}`} flushTop>
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <MemberManager
          key={year}
          year={year}
          view={view}
          onDirtyChange={setDirty}
        />
      )}
    </ManagementPageFrame>
  )
}

export function RolesPage() {
  const {
    years: { year },
  } = useManagement()
  const view = useManagementScreenView(`roles:${year}`)
  return (
    <ManagementPageFrame title="ロール" viewKey={`roles:${year}`} flushTop>
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <YearRoleManager key={year} year={year} view={view} />
      )}
    </ManagementPageFrame>
  )
}

export function YearsPage() {
  const { setDirty } = useManagement()
  return (
    <ManagementPageFrame title="年度" viewKey="years">
      <YearSettingsPanel onDirtyChange={setDirty} />
    </ManagementPageFrame>
  )
}

export function UsersPage() {
  const { setDirty } = useManagement()
  const view = useManagementScreenView("users")
  return (
    <ManagementPageFrame title="ユーザー" viewKey="users" flushTop>
      <UserManager view={view} onDirtyChange={setDirty} />
    </ManagementPageFrame>
  )
}

export function DiscordLinksPage() {
  return (
    <ManagementPageFrame title="Discord連携申請" viewKey="discord-links">
      <DiscordLinkRequestManager />
    </ManagementPageFrame>
  )
}

export function AuditPage() {
  return (
    <ManagementPageFrame title="操作履歴" viewKey="audit">
      <AuditLogManager />
    </ManagementPageFrame>
  )
}

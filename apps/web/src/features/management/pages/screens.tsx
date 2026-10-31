import { useState } from "react"
import { EmptyState } from "@/app/page-layout"
import { Link } from "@tanstack/react-router"
import { YearTagManager } from "@/features/members/components/year-tag-manager"
import { UserManager } from "@/features/admin/components/user-manager"
import { AuditLogManager } from "@/features/admin/components/audit-log-manager"
import { AvailabilitySummary } from "@/features/availability/components/availability-summary"
import { YearManager } from "@/features/years/components/year-manager"
import { MemberManager } from "@/features/members/components/member-manager"
import { YearRoleManager } from "@/features/roles/components/year-role-manager"
import { useManagement, useManagementScreenView } from "../management-context"
import { ManagementPageFrame } from "./page-frame"

export function ManagementAvailabilityPage() {
  const [pending, setPending] = useState(false)
  const {
    years: { year },
    setDirty,
  } = useManagement()
  return (
    <ManagementPageFrame
      pending={pending}
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
        <AvailabilitySummary
          key={year}
          year={year}
          onDirtyChange={setDirty}
          onPendingChange={setPending}
        />
      )}
    </ManagementPageFrame>
  )
}

export function MembersPage() {
  const [pending, setPending] = useState(false)
  const {
    years: { year },
    setDirty,
  } = useManagement()
  const view = useManagementScreenView(`members:${year}`)
  return (
    <ManagementPageFrame
      pending={pending}
      title="メンバー"
      viewKey={`members:${year}`}
      contentWidth="full"
    >
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <MemberManager
          key={year}
          year={year}
          view={view}
          onDirtyChange={setDirty}
          onPendingChange={setPending}
        />
      )}
    </ManagementPageFrame>
  )
}

export function RolesPage() {
  const [status, setStatus] = useState({ dirty: false, pending: false })
  const {
    years: { year },
  } = useManagement()
  const view = useManagementScreenView(`roles:${year}`)
  return (
    <ManagementPageFrame
      title="ロール"
      dirty={status.dirty}
      pending={status.pending}
      viewKey={`roles:${year}`}
      contentWidth="full"
    >
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <YearRoleManager
          key={year}
          year={year}
          view={view}
          onStatusChange={setStatus}
        />
      )}
    </ManagementPageFrame>
  )
}

export function YearsPage() {
  const [pending, setPending] = useState(false)
  const { setDirty } = useManagement()
  const view = useManagementScreenView("years")
  return (
    <ManagementPageFrame
      pending={pending}
      title="年度"
      viewKey="years"
      contentWidth="full"
    >
      <YearManager
        view={view}
        onDirtyChange={setDirty}
        onPendingChange={setPending}
      />
    </ManagementPageFrame>
  )
}

export function UsersPage() {
  const [pending, setPending] = useState(false)
  const { setDirty } = useManagement()
  const view = useManagementScreenView("users")
  return (
    <ManagementPageFrame
      pending={pending}
      title="ユーザー"
      viewKey="users"
      contentWidth="full"
    >
      <UserManager
        view={view}
        onDirtyChange={setDirty}
        onPendingChange={setPending}
      />
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

export function TagsPage() {
  const [status, setStatus] = useState({ dirty: false, pending: false })
  const {
    years: { year },
  } = useManagement()
  const view = useManagementScreenView(`tags:${year}`)
  return (
    <ManagementPageFrame
      title="タグ"
      viewKey={`tags:${year}`}
      contentWidth="full"
      dirty={status.dirty}
      pending={status.pending}
    >
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <YearTagManager
          key={year}
          year={year}
          view={view}
          onStatusChange={setStatus}
        />
      )}
    </ManagementPageFrame>
  )
}

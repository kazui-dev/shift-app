import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@/app/page-layout"
import { QueryError } from "@/components/query-error"
import { RoleEditor } from "@/features/roles/components/role-editor"
import { permissions } from "@/features/roles/components/role-permissions"
import { TagEditor } from "@/features/members/components/tag-editor"
import { LabelMembersManager } from "@/features/members/components/label-members-manager"
import { tagsQuery } from "@/features/members/data/tags"
import { rolesQuery, rosterQuery } from "@/features/years/data/years"
import { useManagement, useManagementScreenView } from "../management-context"
import { ManagementPageFrame } from "./page-frame"

export function ManagementLabelPage({
  kind,
  yearParam,
  id,
  mode,
}: {
  kind: "role" | "tag"
  yearParam: string
  id: string | null
  mode: "members" | "settings" | "create"
}) {
  const year = Number(yearParam)
  const { years } = useManagement()
  const allowed =
    Number.isSafeInteger(year) && years.years.some((item) => item.year === year)
  useEffect(() => {
    if (allowed && years.year !== year) years.selectYear(year)
  }, [allowed, year, years])
  const roleQuery = useQuery({
    ...rolesQuery(year),
    enabled: allowed && kind === "role",
  })
  const tagQuery = useQuery({
    ...tagsQuery(year),
    enabled: allowed && kind === "tag",
  })
  const roster = useQuery({
    ...rosterQuery(year),
    enabled: allowed && kind === "role" && mode === "members",
  })
  const query = kind === "role" ? roleQuery : tagQuery
  const role = roleQuery.data?.roles.find((item) => item.id === id)
  const tag = tagQuery.data?.tags.find((item) => item.id === id)
  const item = kind === "role" ? role : tag
  const label = kind === "role" ? "ロール" : "タグ"
  const authority = roleQuery.data?.authority
  const canEdit =
    kind === "tag"
      ? tagQuery.isSuccess
      : !!authority &&
        (authority.systemAdmin ||
          (authority.permissions.includes("role.manage") &&
            (!role || role.position < (authority.position ?? -Infinity))))
  const canManageMembers =
    kind === "tag"
      ? tagQuery.isSuccess
      : !!role &&
        !!authority &&
        (authority.systemAdmin ||
          (authority.permissions.includes("member.manage") &&
            role.position < (authority.position ?? -Infinity) &&
            role.permissions.every((permission) =>
              authority.permissions.includes(permission)
            )))
  const positions = new Map(
    roleQuery.data?.roles.map((entry) => [entry.id, entry.position])
  )
  const memberIds =
    kind === "tag"
      ? (tag?.memberIds ?? [])
      : (roster.data?.members ?? [])
          .filter((member) => member.roles.some((entry) => entry.id === id))
          .map((member) => member.id)
  const navigate = useNavigate()
  const allowNavigation = useRef(false)
  const [status, setStatus] = useState({ dirty: false, pending: false })
  const viewKey = `${kind}:${year}:${id ?? "new"}`
  const view = useManagementScreenView(viewKey)
  function close(toList = false) {
    allowNavigation.current = true
    if (toList || id === null)
      void navigate({ to: kind === "role" ? "/manage/roles" : "/manage/tags" })
    else if (kind === "role")
      void navigate({
        to: "/manage/roles/$year/$roleId",
        params: { year: yearParam, roleId: id },
      })
    else
      void navigate({
        to: "/manage/tags/$year/$tagId",
        params: { year: yearParam, tagId: id },
      })
  }
  const back =
    mode === "settings" && id !== null ? (
      kind === "role" ? (
        <Link
          to="/manage/roles/$year/$roleId"
          params={{ year: yearParam, roleId: id }}
        >
          ← メンバー一覧
        </Link>
      ) : (
        <Link
          to="/manage/tags/$year/$tagId"
          params={{ year: yearParam, tagId: id }}
        >
          ← メンバー一覧
        </Link>
      )
    ) : (
      <Link to={kind === "role" ? "/manage/roles" : "/manage/tags"}>
        ← {label}一覧
      </Link>
    )
  const settings = mode === "members" && id !== null && item && (
    <Button
      size="sm"
      variant="outline"
      nativeButton={false}
      render={
        kind === "role" ? (
          <Link
            to="/manage/roles/$year/$roleId/settings"
            params={{ year: yearParam, roleId: id }}
          />
        ) : (
          <Link
            to="/manage/tags/$year/$tagId/settings"
            params={{ year: yearParam, tagId: id }}
          />
        )
      }
    >
      設定
    </Button>
  )
  return (
    <ManagementPageFrame
      title={
        mode === "create"
          ? `${label}を作成`
          : `${item?.name ?? label}${mode === "settings" ? "の設定" : ""}`
      }
      viewKey={viewKey}
      contentWidth={mode === "members" ? "full" : "contained"}
      headerLeading={
        <span className="text-sm text-muted-foreground hover:text-foreground">
          {back}
        </span>
      }
      headerActions={settings}
      dirty={status.dirty}
      pending={status.pending}
      allowNavigation={() => allowNavigation.current}
    >
      {!allowed ? (
        <EmptyState>管理できない年度です</EmptyState>
      ) : query.isError ? (
        <QueryError
          message={`${label}を取得できませんでした。`}
          onRetry={() => query.refetch()}
        />
      ) : query.isPending ? null : id !== null && !item ? (
        <EmptyState>{label}が見つかりません</EmptyState>
      ) : mode === "members" && id !== null && item ? (
        kind === "role" && roster.isError ? (
          <QueryError
            message="メンバーを取得できませんでした。"
            onRetry={() => roster.refetch()}
          />
        ) : kind === "role" && roster.isPending ? null : (
          <LabelMembersManager
            year={year}
            kind={kind}
            id={id}
            name={item.name}
            memberIds={memberIds}
            canEdit={canManageMembers}
            canReadTags={
              kind === "tag" ||
              !!authority?.systemAdmin ||
              !!authority?.permissions.includes("member.manage")
            }
            canEditMember={(member) =>
              kind === "tag" ||
              !!authority?.systemAdmin ||
              member.roles.every(
                (entry) =>
                  (positions.get(entry.id) ?? -Infinity) <
                  (authority?.position ?? -Infinity)
              )
            }
            view={view}
            onStatusChange={setStatus}
          />
        )
      ) : kind === "role" ? (
        <RoleEditor
          year={year}
          role={role ?? null}
          canEdit={canEdit}
          grantable={
            authority?.systemAdmin
              ? permissions.map((permission) => permission.value)
              : (authority?.permissions ?? [])
          }
          onStatusChange={setStatus}
          onClose={() => close()}
          onDeleted={() => close(true)}
        />
      ) : (
        <TagEditor
          year={year}
          tag={tag ?? null}
          onStatusChange={setStatus}
          onClose={() => close()}
          onDeleted={() => close(true)}
        />
      )}
    </ManagementPageFrame>
  )
}

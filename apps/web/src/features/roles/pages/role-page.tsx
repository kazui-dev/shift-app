import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getRouteApi,
  Link,
  useBlocker,
  useNavigate,
} from "@tanstack/react-router"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@/app/page-layout"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useManagement } from "@/features/management/management-context"
import { rolesQuery } from "@/features/years/data/years"
import { RoleEditor } from "../components/role-editor"
import { permissions } from "../components/role-permissions"

const createRoute = getRouteApi("/_app/manage/roles_/$year/new")
const detailRoute = getRouteApi("/_app/manage/roles_/$year/$roleId")

export function CreateRolePage() {
  const { year } = createRoute.useParams()
  return <RolePage key={`${year}:new`} yearParam={year} roleId={null} />
}

export function RoleDetailPage() {
  const { year, roleId } = detailRoute.useParams()
  return <RolePage key={`${year}:${roleId}`} yearParam={year} roleId={roleId} />
}

function RolePage({
  yearParam,
  roleId,
}: {
  yearParam: string
  roleId: string | null
}) {
  const year = Number(yearParam)
  const { years } = useManagement()
  const allowed =
    Number.isSafeInteger(year) && years.years.some((item) => item.year === year)
  useEffect(() => {
    if (allowed && years.year !== year) years.selectYear(year)
  }, [allowed, year, years])
  const query = useQuery({ ...rolesQuery(year), enabled: allowed })
  const navigate = useNavigate()
  const allowNavigation = useRef(false)
  const [dirty, setDirty] = useState(false)
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !allowNavigation.current,
    enableBeforeUnload: dirty,
    withResolver: true,
  })
  const role = query.data?.roles.find((item) => item.id === roleId)
  const authority = query.data?.authority
  const canEdit =
    !!authority &&
    (authority.systemAdmin ||
      (authority.permissions.includes("role.manage") &&
        (role
          ? role.position < (authority.position ?? Number.NEGATIVE_INFINITY)
          : true)))

  function close() {
    allowNavigation.current = true
    years.selectYear(year)
    void navigate({ to: "/manage/roles" })
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader className="sm:px-6">
        <Link
          to="/manage/roles"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← ロール一覧
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-base font-medium">
          {roleId === null ? "ロールを作成" : (role?.name ?? "ロール")}
        </h2>
        {Number.isSafeInteger(year) && (
          <span className="text-sm text-muted-foreground">{year}年度</span>
        )}
      </PageHeader>
      <div className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto px-4 py-6 sm:px-6">
        {!allowed ? (
          <EmptyState>管理できない年度です</EmptyState>
        ) : query.isPending ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : query.isError ? (
          <p role="alert">
            ロールを取得できませんでした。
            <Button
              size="sm"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              再試行
            </Button>
          </p>
        ) : roleId !== null && !role ? (
          <EmptyState>ロールが見つかりません</EmptyState>
        ) : (
          <RoleEditor
            key={roleId ?? "new"}
            year={year}
            role={role ?? null}
            canEdit={canEdit}
            grantable={
              authority?.systemAdmin
                ? permissions.map((item) => item.value)
                : (authority?.permissions ?? [])
            }
            onDirtyChange={setDirty}
            onClose={close}
          />
        )}
      </div>
      {blocker.status === "blocked" && (
        <ConfirmDialog
          title="未保存の変更を破棄して移動しますか"
          confirmLabel="移動する"
          onCancel={() => blocker.reset()}
          onConfirm={() => blocker.proceed()}
        />
      )}
    </section>
  )
}

import { PageHeader } from "@workspace/ui/components/page-header"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { ManagementHome } from "./home"
import { useManagement } from "./context"
import { ManagementProvider } from "./provider"
import { ActivityManager } from "./activity-manager"
import { EmptyState } from "@/components/page-layout"
import { useManagementBack } from "./use-management-back"
import { ArrowLeft } from "lucide-react"
import { buttonVariants } from "@workspace/ui/components/button"

export function ManagementLayout() {
  return (
    <ManagementProvider>
      <ManagementWorkspace />
    </ManagementProvider>
  )
}

function ManagementWorkspace() {
  const {
    years: { year },
  } = useManagement()
  const pathname = useRouterState({
    select: (state) => state.matches.at(-1)?.pathname ?? "/manage",
  })
  const shifts = pathname.startsWith("/manage/shifts")
  const editing =
    shifts &&
    pathname !== "/manage/shifts" &&
    !pathname.endsWith("/availability")
  const close = useManagementBack(editing ? "/manage/shifts" : "/manage")

  return (
    <div className="relative grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
      <div
        inert={shifts}
        className={`col-start-1 row-start-1 flex min-h-0 flex-col ${shifts ? "invisible" : ""}`}
      >
        <ManagementHome />
      </div>
      <section
        className={`col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col ${shifts ? "bg-background" : "pointer-events-none"}`}
      >
        {shifts && (
          <PageHeader className="gap-4 sm:px-6">
            <button
              type="button"
              onClick={close}
              aria-label={editing ? "シフト一覧に戻る" : "管理に戻る"}
              className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
            </button>
            <h1 className="flex-1 text-base font-medium">シフト</h1>
            <Link
              to="/manage/shifts/availability"
              state={{ managementParent: pathname }}
              className={buttonVariants({ variant: "outline" })}
            >
              シフト希望フォーム
            </Link>
          </PageHeader>
        )}
        <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
          {shifts && (
            <div
              inert={editing}
              className={`col-start-1 row-start-1 flex min-h-0 flex-col ${editing ? "invisible" : ""}`}
            >
              {year === null ? (
                <EmptyState>管理できる年度がありません</EmptyState>
              ) : (
                <ActivityManager key={year} year={year} />
              )}
            </div>
          )}
          <div
            className={`col-start-1 row-start-1 flex min-h-0 flex-col ${editing ? "bg-background" : "pointer-events-none"}`}
          >
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  )
}

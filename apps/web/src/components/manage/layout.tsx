import { Outlet, useRouterState } from "@tanstack/react-router"
import { ManagePage } from "@/pages/manage-page"

export function ManagementLayout() {
  const shifts = useRouterState({
    select: (state) => state.location.pathname.startsWith("/manage/shifts"),
  })
  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)]">
      <div
        className={`col-start-1 row-start-1 ${shifts ? "md:invisible" : ""}`}
      >
        <ManagePage view="home" />
      </div>
      <div className="col-start-1 row-start-1 min-h-0 min-w-0 empty:hidden">
        <Outlet />
      </div>
    </div>
  )
}

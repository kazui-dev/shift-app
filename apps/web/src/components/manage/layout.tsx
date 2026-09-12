import { Outlet, useRouterState } from "@tanstack/react-router"
import { ManagePage } from "@/pages/manage-page"

export function ManagementLayout() {
  const shifts = useRouterState({
    select: (state) => state.location.pathname.startsWith("/manage/shifts"),
  })
  return (
    <>
      <div className={shifts ? "md:hidden" : undefined}>
        <ManagePage view="home" />
      </div>
      <Outlet />
    </>
  )
}

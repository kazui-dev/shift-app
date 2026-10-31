import { ManagementNavigationContext } from "../navigation-context"
import { useState } from "react"
import {
  getRouteApi,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { ManagementProvider } from "./provider"

const workItems = [
  { to: "/manage/shifts", label: "シフト" },
  { to: "/manage/members", label: "メンバー" },
  { to: "/manage/roles", label: "ロール" },
  { to: "/manage/tags", label: "タグ" },
] as const
const systemItems = [
  { to: "/manage/years", label: "年度" },
  { to: "/manage/users", label: "ユーザー" },
  { to: "/manage/audit", label: "操作履歴" },
] as const
const appRoute = getRouteApi("/_app")

export function ManagementLayout() {
  return (
    <ManagementProvider>
      <ManagementWorkspace />
    </ManagementProvider>
  )
}

function ManagementWorkspace() {
  const { state } = appRoute.useRouteContext()
  const pathname = useRouterState({
    select: (router) => router.matches.at(-1)?.pathname ?? "/manage",
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const navigation = (
    <nav aria-label="管理メニュー" className="px-3 py-4">
      <MenuGroup
        items={workItems}
        pathname={pathname}
        onSelect={() => setMenuOpen(false)}
      />
      {state.member.accessLevel === "system_admin" && (
        <MenuGroup
          className="mt-6"
          title="システム管理"
          items={systemItems}
          pathname={pathname}
          onSelect={() => setMenuOpen(false)}
        />
      )}
    </nav>
  )

  return (
    <ManagementNavigationContext value={() => setMenuOpen(true)}>
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-40 shrink-0 overflow-y-auto border-r md:block">
          {navigation}
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="gap-0 md:hidden">
          <SheetHeader>
            <SheetTitle>管理</SheetTitle>
          </SheetHeader>
          {navigation}
        </SheetContent>
      </Sheet>
    </ManagementNavigationContext>
  )
}

function MenuGroup({
  className,
  title,
  items,
  pathname,
  onSelect,
}: {
  className?: string
  title?: string
  items: readonly { to: string; label: string }[]
  pathname: string
  onSelect: () => void
}) {
  return (
    <div className={className}>
      {title && (
        <h2 className="px-3 pb-2 text-xs font-medium text-muted-foreground">
          {title}
        </h2>
      )}
      <ul className="space-y-1">
        {items.map((item) => {
          const selected =
            pathname === item.to || pathname.startsWith(`${item.to}/`)
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={selected ? "page" : undefined}
                onClick={onSelect}
                className={`flex min-h-10 items-center rounded-lg px-3 text-sm transition-colors hover:bg-muted ${selected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

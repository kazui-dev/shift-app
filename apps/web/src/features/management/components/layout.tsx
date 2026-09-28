import { useState } from "react"
import {
  getRouteApi,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { ManagementProvider } from "./provider"
import { ManagementYearSelect } from "./year-select"
import { useManagement } from "../management-context"

const workItems = [
  { to: "/manage/shifts", label: "シフト" },
  { to: "/manage/members", label: "メンバー" },
  { to: "/manage/roles", label: "ロール" },
] as const
const systemItems = [
  { to: "/manage/years", label: "年度" },
  { to: "/manage/users", label: "ユーザー" },
  { to: "/manage/discord-link-requests", label: "Discord連携申請" },
  { to: "/manage/audit", label: "操作履歴" },
] as const

export function ManagementLayout() {
  return (
    <ManagementProvider>
      <ManagementWorkspace />
    </ManagementProvider>
  )
}

function ManagementWorkspace() {
  const { state } = getRouteApi("/_app").useRouteContext()
  const { dirty } = useManagement()
  const { pathname, editingShift } = useRouterState({
    select: (router) => ({
      pathname: router.matches.at(-1)?.pathname ?? "/manage",
      editingShift:
        router.matches.at(-1)?.routeId === "/_app/manage/shifts_/$shiftId",
    }),
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [editorMenuOpen, setEditorMenuOpen] = useState(false)
  const showDesktopMenu = !editingShift || editorMenuOpen
  const yearLockedToRoute =
    (pathname.startsWith("/manage/shifts/") &&
      pathname !== "/manage/shifts/availability") ||
    pathname.startsWith("/manage/roles/")

  const navigation = (
    <nav aria-label="管理メニュー" className="px-3 py-4">
      <div className="mb-1">
        <ManagementYearSelect disabled={dirty || yearLockedToRoute} />
      </div>
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader className="sm:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="管理メニューを開く"
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </Button>
        {editingShift && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            aria-label={
              showDesktopMenu
                ? "管理メニューを折りたたむ"
                : "管理メニューを表示"
            }
            aria-controls="management-desktop-menu"
            aria-expanded={showDesktopMenu}
            onClick={() => setEditorMenuOpen(!editorMenuOpen)}
          >
            {showDesktopMenu ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        )}
        <h1 className="min-w-0 flex-1 text-base font-semibold">管理</h1>
      </PageHeader>
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside
          id="management-desktop-menu"
          className={`hidden w-52 shrink-0 overflow-y-auto border-r [scrollbar-width:none] lg:w-56 ${showDesktopMenu ? "md:block" : ""}`}
        >
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
    </div>
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

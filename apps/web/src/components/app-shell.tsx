import { Link, Outlet } from "@tanstack/react-router"
import {
  CalendarDays,
  ClipboardList,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react"

import type { AuthState } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

const navigation = [
  { to: "/timeline", label: "タイムライン", icon: CalendarDays },
  { to: "/availability", label: "希望提出", icon: ClipboardList },
  { to: "/chat", label: "連絡", icon: MessagesSquare },
  { to: "/manage", label: "シフト管理", icon: Users },
] as const

export function AppShell({
  state,
}: {
  state: Extract<AuthState, { status: "active" }>
}) {
  return (
    <div className="mx-auto min-h-svh max-w-6xl px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-10">
      <header className="mb-8 flex min-h-12 items-center justify-between gap-4 border-b pb-4">
        <p className="font-semibold tracking-tight">旭祭シフト</p>
        {state.member.accessLevel === "system_admin" && (
          <Button asChild size="icon-sm" variant="ghost">
            <Link to="/system" aria-label="システム管理">
              <Settings />
            </Link>
          </Button>
        )}
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:static md:mb-8 md:rounded-xl md:border md:bg-background md:p-1 md:backdrop-blur-none">
        <div className="mx-auto grid max-w-2xl grid-cols-4 px-1 md:max-w-none md:px-0">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.6875rem] text-muted-foreground transition-colors md:min-h-10 md:flex-row md:gap-2 md:text-sm"
              activeProps={{
                className: "font-medium text-foreground",
              }}
            >
              <Icon className="size-[1.125rem]" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  )
}

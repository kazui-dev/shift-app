import { Link, Outlet } from "@tanstack/react-router"
import { CalendarDays, MessageCircle, Settings, Users } from "lucide-react"

import type { AuthState } from "@workspace/shared/auth"

const navigation = [
  { to: "/timeline", label: "カレンダー", icon: CalendarDays },
  { to: "/chat", label: "連絡", icon: MessageCircle },
  { to: "/manage", label: "シフト管理", icon: Users },
] as const

export function AppShell({
  state,
}: {
  state: Extract<AuthState, { status: "active" }>
}) {
  const items =
    state.member.accessLevel === "system_admin"
      ? [
          ...navigation,
          {
            to: "/system",
            label: "設定",
            icon: Settings,
          } as const,
        ]
      : navigation

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10">
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:static md:mb-8 md:border-t-0 md:border-b md:bg-transparent md:backdrop-blur-none">
        <div
          className="mx-auto grid max-w-2xl px-1 md:max-w-none md:px-0"
          style={{
            gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          }}
        >
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-16 items-center justify-center text-muted-foreground transition-colors md:min-h-12"
              activeProps={{
                className: "text-foreground [&_svg]:stroke-[2.5]",
              }}
            >
              <Icon className="size-5" />
              <span className="sr-only">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  )
}

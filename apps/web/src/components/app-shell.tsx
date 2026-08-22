import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import {
  CalendarDays,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"

import type { AuthState } from "@workspace/shared/auth"

import { CalendarViewStateProvider } from "./calendar-view-state"

const navigation = [
  { to: "/timeline", label: "カレンダー", icon: CalendarDays },
  { to: "/chat", label: "連絡", icon: MessageCircle },
  { to: "/manage", label: "シフト管理", icon: Users },
  { to: "/settings", label: "設定", icon: Settings },
] as const

export function AppShell({
  state,
}: {
  state: Extract<AuthState, { status: "active" }>
}) {
  const isTimeline = useRouterState({
    select: (routerState) =>
      routerState.matches.some((match) => match.routeId === "/_app/timeline"),
  })
  const items =
    state.member.accessLevel === "system_admin"
      ? [
          ...navigation,
          {
            to: "/system",
            label: "管理",
            icon: ShieldCheck,
          } as const,
        ]
      : navigation

  return (
    <div
      className={
        isTimeline
          ? "mx-auto flex h-dvh max-w-6xl flex-col overflow-hidden overscroll-none px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-4"
          : "mx-auto min-h-svh max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10"
      }
    >
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:static md:border-t-0 md:border-b md:bg-transparent md:backdrop-blur-none ${isTimeline ? "md:mb-4" : "md:mb-8"}`}
      >
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
              preload="render"
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

      <CalendarViewStateProvider>
        <Outlet />
      </CalendarViewStateProvider>
    </div>
  )
}

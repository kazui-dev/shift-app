import { useEffect, useState } from "react"
import { onlineManager, useQueryClient } from "@tanstack/react-query"
import {
  Link,
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { CalendarDays, MessageCircle, Settings, Users } from "lucide-react"

import { CalendarViewStateProvider } from "./calendar-view-state"
import { OfflineModeContext } from "./offline-mode-context"

const navigation = [
  { to: "/calendar", label: "カレンダー", icon: CalendarDays },
  { to: "/chat", label: "チャット", icon: MessageCircle },
  { to: "/manage", label: "管理", icon: Users },
  { to: "/settings", label: "設定", icon: Settings },
] as const

const unsafeOfflineRoutes = new Set(["/availability", "/manage", "/system"])

export function AppShell({ accountOffline }: { accountOffline: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { isCalendar, pathname } = useRouterState({
    select: (routerState) => ({
      isCalendar: routerState.matches.some(
        (match) => match.routeId === "/_app/calendar"
      ),
      pathname: routerState.location.pathname,
    }),
  })
  const [browserOffline, setBrowserOffline] = useState(() => !navigator.onLine)
  const offline = accountOffline || browserOffline
  const unsafeOfflineRoute =
    offline &&
    (unsafeOfflineRoutes.has(pathname) || pathname.startsWith("/manage/"))

  useEffect(() => {
    const revalidateAccount = () => {
      if (!navigator.onLine) return
      void queryClient
        .invalidateQueries({ queryKey: ["account"], refetchType: "none" })
        .then(() => router.invalidate())
    }
    const handleOffline = () => setBrowserOffline(true)
    const handleOnline = () => {
      setBrowserOffline(false)
      revalidateAccount()
    }
    const handleFocus = () => {
      if (accountOffline) revalidateAccount()
    }
    const timer = accountOffline
      ? window.setInterval(revalidateAccount, 30_000)
      : null
    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)
    window.addEventListener("focus", handleFocus)
    return () => {
      if (timer !== null) window.clearInterval(timer)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("focus", handleFocus)
    }
  }, [accountOffline, queryClient, router])

  useEffect(() => {
    onlineManager.setOnline(!offline)
  }, [offline])

  useEffect(() => {
    if (unsafeOfflineRoute) {
      void navigate({ to: "/calendar", replace: true })
    }
  }, [navigate, unsafeOfflineRoute])

  const visibleNavigation = offline
    ? navigation.filter((item) => item.to !== "/manage")
    : navigation
  const items = visibleNavigation

  return (
    <div
      className={
        isCalendar
          ? "mx-auto flex h-dvh max-w-6xl flex-col overflow-hidden overscroll-none px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-4"
          : "mx-auto min-h-svh max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-8"
      }
    >
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:static md:border-t-0 md:border-b md:bg-transparent md:backdrop-blur-none ${isCalendar ? "md:mb-4" : "md:mb-6"}`}
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

      <output className="sr-only" aria-live="polite">
        {offline ? "オフラインです" : ""}
      </output>
      <OfflineModeContext value={offline}>
        <CalendarViewStateProvider>
          {unsafeOfflineRoute ? null : <Outlet />}
        </CalendarViewStateProvider>
      </OfflineModeContext>
    </div>
  )
}

import { useEffect, useState } from "react"
import { onlineManager, useQueryClient } from "@tanstack/react-query"
import {
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { useChatViewport } from "@/hooks/use-chat-viewport"
import { ChatDelivery } from "./chat/delivery"
import { AppNavigation } from "./app-navigation"

import { CalendarViewStateProvider } from "./calendar-view-state"
import { OfflineModeContext } from "./offline-mode-context"

const unsafeOfflineRoutes = new Set(["/availability", "/manage", "/system"])

export function AppShell({ accountOffline }: { accountOffline: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { isCalendar, isChat, pathname } = useRouterState({
    select: (routerState) => ({
      isCalendar: routerState.matches.some(
        (match) => match.routeId === "/_app/calendar"
      ),
      isChat: routerState.matches.some(
        (match) => match.routeId === "/_app/chat"
      ),
      pathname: routerState.matches.at(-1)?.pathname ?? "/",
    }),
  })
  const { shell, composing } = useChatViewport(isChat)
  const fitted = isCalendar || isChat
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

  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  )
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const resize = () => setSidebarOpen(query.matches)
    query.addEventListener("change", resize)
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b")
        return
      if (!window.matchMedia("(min-width: 768px)").matches) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable=true]")
      )
        return
      event.preventDefault()
      setSidebarOpen((open) => !open)
    }
    window.addEventListener("keydown", shortcut)
    return () => {
      query.removeEventListener("change", resize)
      window.removeEventListener("keydown", shortcut)
    }
  }, [])

  return (
    <div
      ref={shell}
      data-sidebar-open={sidebarOpen}
      data-composing={composing}
      className={`${isChat ? "max-md:fixed max-md:inset-x-0 max-md:top-[var(--chat-viewport-top,0px)] max-md:h-[var(--chat-viewport-height,100dvh)]" : ""} ${
        fitted
          ? "flex h-dvh w-full min-w-0 flex-col overflow-hidden overscroll-none transition-[padding-left] duration-200 ease-linear motion-reduce:transition-none md:pl-(--app-sidebar-width)"
          : "min-h-svh w-full min-w-0 transition-[padding-left] duration-200 ease-linear motion-reduce:transition-none md:pl-(--app-sidebar-width)"
      }`}
    >
      <AppNavigation
        offline={offline}
        hiddenOnMobile={composing}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen((open) => !open)}
      />

      <output className="sr-only" aria-live="polite">
        {offline ? "オフラインです" : ""}
      </output>
      <OfflineModeContext value={offline}>
        <ChatDelivery />
        <CalendarViewStateProvider>
          <main
            className={`flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] transition-[padding-bottom] duration-200 ease-out motion-reduce:transition-none sm:px-6 md:pt-6 ${isChat ? "md:pl-2" : ""} ${composing ? "pb-[env(safe-area-inset-bottom)]" : fitted ? "pb-[calc(3.5rem+1px+env(safe-area-inset-bottom))] md:pb-4" : "pb-[calc(4.5rem+1px+env(safe-area-inset-bottom))] md:pb-8"}`}
          >
            {unsafeOfflineRoute ? null : <Outlet />}
          </main>
        </CalendarViewStateProvider>
      </OfflineModeContext>
    </div>
  )
}

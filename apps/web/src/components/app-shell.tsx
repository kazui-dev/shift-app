import { useEffect, useState } from "react"
import { keys } from "@/data/keys"
import { onlineManager, useQueryClient } from "@tanstack/react-query"
import {
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { useChatViewport } from "@/hooks/use-chat-viewport"
import { ChatDelivery } from "./chat/delivery"
import { LiveEvents } from "./live-events"
import { AppNavigation } from "./app-navigation"

import { OfflineModeContext } from "./offline-mode-context"
import { verifyAccountState } from "@/lib/account/state"

const unsafeOfflineRoutes = new Set([
  "/calendar/availability",
  "/manage",
  "/system",
])

export function AppShell({
  accountOffline,
  accountChecking,
}: {
  accountOffline: boolean
  accountChecking: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { isCalendar, isChat, pathname } = useRouterState({
    select: (routerState) => ({
      isCalendar: routerState.matches.some(
        (match) => match.routeId === "/_app/_calendar"
      ),
      isChat: routerState.matches.some(
        (match) => match.routeId === "/_app/chat"
      ),
      pathname: routerState.matches.at(-1)?.pathname ?? "/",
    }),
  })
  const shell = useChatViewport(isChat)
  const fitted = isCalendar || isChat
  const [browserOffline, setBrowserOffline] = useState(() => !navigator.onLine)
  const offline = accountOffline || browserOffline
  const unsafeOfflineRoute =
    offline &&
    (unsafeOfflineRoutes.has(pathname) || pathname.startsWith("/manage/"))

  useEffect(() => {
    if (!accountChecking) return undefined
    let active = true
    void verifyAccountState(queryClient)
      .then(() => {
        if (active) return router.invalidate()
        return undefined
      })
      .catch(() => {
        if (active) void router.invalidate()
      })
    return () => {
      active = false
    }
  }, [accountChecking, queryClient, router])

  useEffect(() => {
    const revalidateAccount = () => {
      if (!navigator.onLine) return
      void queryClient
        .invalidateQueries({ queryKey: keys.account(), refetchType: "none" })
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

  return (
    <div
      ref={shell}
      data-chat-shell={isChat ? "" : undefined}
      data-app-shell=""
      className={`relative grid w-full min-w-0 grid-cols-[minmax(0,1fr)] pt-[env(safe-area-inset-top)] md:grid-cols-[var(--app-sidebar-width)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:pt-0 ${isChat ? "grid-rows-[minmax(0,1fr)] max-md:h-[var(--chat-viewport-height,100dvh)]" : "grid-rows-[minmax(0,1fr)_auto]"} ${
        fitted
          ? `h-dvh overscroll-x-none overscroll-y-auto ${isChat ? "" : "overflow-hidden"}`
          : "min-h-svh"
      }`}
    >
      <AppNavigation offline={offline} desktopOnly={isChat} />

      <output className="sr-only" aria-live="polite">
        {offline ? "オフラインです" : ""}
      </output>
      <OfflineModeContext value={offline}>
        <LiveEvents />
        <ChatDelivery />
        <main className="row-start-1 flex min-h-0 min-w-0 flex-col md:col-start-2">
          {unsafeOfflineRoute ? null : <Outlet />}
        </main>
      </OfflineModeContext>
    </div>
  )
}

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

import { OfflineModeContext } from "./offline-mode-context"
import { resolveAccountState } from "@/lib/account-state"

const unsafeOfflineRoutes = new Set(["/availability", "/manage", "/system"])

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
    void resolveAccountState(queryClient)
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

  return (
    <div
      ref={shell}
      data-chat-shell={isChat ? "" : undefined}
      data-app-shell=""
      className={`${isChat ? "relative max-md:h-[var(--chat-viewport-height,100dvh)]" : fitted ? "overflow-hidden" : ""} ${
        fitted
          ? "flex h-dvh w-full min-w-0 flex-col overscroll-x-none overscroll-y-auto md:pl-(--app-sidebar-width)"
          : "min-h-svh w-full min-w-0 md:pl-(--app-sidebar-width)"
      }`}
    >
      <AppNavigation offline={offline} desktopOnly={isChat} />

      <output className="sr-only" aria-live="polite">
        {offline ? "オフラインです" : ""}
      </output>
      <OfflineModeContext value={offline}>
        <ChatDelivery />
        <main
          className={`flex min-h-0 min-w-0 flex-1 flex-col pt-[calc(env(safe-area-inset-top)+0.75rem)] ${isChat ? "md:pt-3" : "md:pt-6"} ${isChat ? "px-0 md:px-6" : "px-4 sm:px-6"} ${isChat ? "md:pl-2" : ""} ${isChat ? "pb-0 md:pb-4" : fitted ? "pb-[calc(4.25rem+1px+env(safe-area-inset-bottom))] md:pb-4" : "pb-[calc(5.25rem+1px+env(safe-area-inset-bottom))] md:pb-8"}`}
        >
          {unsafeOfflineRoute ? null : <Outlet />}
        </main>
      </OfflineModeContext>
    </div>
  )
}

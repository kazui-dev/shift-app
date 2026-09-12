import { settleChatStorage } from "@/lib/chat-store"
import { activateAppUpdate } from "@/lib/app-update"
import { toast } from "@workspace/ui/lib/toast"
import { useEffect, useRef, useState } from "react"
import { LoaderCircle, RefreshCw, X } from "lucide-react"
import { registerSW } from "virtual:pwa-register"
import { monitorUpdates } from "@/lib/update-monitor"

import { Button } from "@workspace/ui/components/button"

const updateCheckInterval = 5 * 60 * 1000

export function PwaUpdateNotice() {
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const updateAbort = useRef<AbortController | null>(null)
  const initialController = useRef(navigator.serviceWorker?.controller ?? null)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined
    let disposed = false
    let monitor: ReturnType<typeof monitorUpdates> | undefined
    const check = () => {
      void monitor?.check()
    }
    registerSW({
      immediate: true,
      // A different tab activating its worker must not reload an editing page.
      onNeedReload: () => {},
      onRegisteredSW: (_url, registration) => {
        if (disposed || !registration) return
        monitor = monitorUpdates(
          registration,
          () => {
            setNeedsRefresh(true)
            setDismissed(false)
          },
          () => navigator.onLine && document.visibilityState === "visible"
        )
      },
    })
    const timer = window.setInterval(check, updateCheckInterval)
    window.addEventListener("focus", check)
    window.addEventListener("online", check)
    document.addEventListener("visibilitychange", check)
    return () => {
      disposed = true
      monitor?.dispose()
      updateAbort.current?.abort()
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
      window.removeEventListener("online", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [])

  if ((!needsRefresh && !updating) || dismissed) return null

  const applyUpdate = async () => {
    if (updating) return
    setUpdating(true)
    const abort = new AbortController()
    updateAbort.current = abort
    try {
      await settleChatStorage()
      await activateAppUpdate(
        navigator.serviceWorker,
        initialController.current,
        abort.signal
      )
      await settleChatStorage()
      window.location.reload()
    } catch (error) {
      if (!abort.signal.aborted) {
        setUpdating(false)
        toast.error(
          error instanceof Error ? error.message : "更新に失敗しました。"
        )
      }
    } finally {
      updateAbort.current = null
    }
  }

  return (
    <output
      data-app-update-notice=""
      className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg md:bottom-6"
      aria-live="polite"
      aria-busy={updating}
    >
      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        新しいバージョンがあります
      </p>
      <Button
        className="w-18"
        size="sm"
        disabled={updating}
        onClick={() => void applyUpdate()}
      >
        <span className="grid size-4 shrink-0 place-items-center">
          {updating ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </span>
        更新
      </Button>
      <button
        className="ml-3 shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        aria-label="更新通知を閉じる"
        disabled={updating}
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </button>
    </output>
  )
}

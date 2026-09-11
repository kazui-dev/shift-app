import { activateAppUpdate } from "@/lib/app-update"
import { toast } from "@workspace/ui/lib/toast"
import { useEffect, useRef, useState } from "react"
import { LoaderCircle, RefreshCw, X } from "lucide-react"
import { useRegisterSW } from "virtual:pwa-register/react"

import { Button } from "@workspace/ui/components/button"

const updateCheckInterval = 60 * 60 * 1000

export function PwaUpdateNotice() {
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const updateAbort = useRef<AbortController | null>(null)
  const initialController = useRef(navigator.serviceWorker?.controller ?? null)
  const {
    needRefresh: [needsRefresh, setNeedsRefresh],
  } = useRegisterSW({
    immediate: true,
    onNeedReload: () => setNeedsRefresh(true),
  })

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined

    let disposed = false
    const checkForUpdate = async () => {
      if (
        disposed ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      ) {
        return
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (!disposed) await registration?.update()
      } catch {}
    }
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate()
      }
    }
    const timer = window.setInterval(
      () => void checkForUpdate(),
      updateCheckInterval
    )
    window.addEventListener("focus", checkWhenVisible)
    window.addEventListener("online", checkWhenVisible)
    document.addEventListener("visibilitychange", checkWhenVisible)

    return () => {
      disposed = true
      updateAbort.current?.abort()
      window.clearInterval(timer)
      window.removeEventListener("focus", checkWhenVisible)
      window.removeEventListener("online", checkWhenVisible)
      document.removeEventListener("visibilitychange", checkWhenVisible)
    }
  }, [])

  if ((!needsRefresh && !updating) || dismissed) return null

  const applyUpdate = async () => {
    if (updating) return
    setUpdating(true)
    const abort = new AbortController()
    updateAbort.current = abort
    try {
      await activateAppUpdate(
        navigator.serviceWorker,
        initialController.current,
        abort.signal
      )
      window.location.reload()
    } catch (error) {
      if (!abort.signal.aborted)
        toast.error(
          error instanceof Error ? error.message : "更新に失敗しました。"
        )
    } finally {
      updateAbort.current = null
      setUpdating(false)
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

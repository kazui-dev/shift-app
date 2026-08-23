import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useRegisterSW } from "virtual:pwa-register/react"

import { Button } from "@workspace/ui/components/button"

const updateCheckInterval = 60 * 60 * 1000

export function PwaUpdateNotice() {
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const {
    needRefresh: [needsRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

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
        const registration = await navigator.serviceWorker.ready
        if (!disposed) await registration.update()
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
      window.clearInterval(timer)
      window.removeEventListener("focus", checkWhenVisible)
      window.removeEventListener("online", checkWhenVisible)
      document.removeEventListener("visibilitychange", checkWhenVisible)
    }
  }, [])

  if (!needsRefresh || dismissed) return null

  const applyUpdate = async () => {
    setUpdating(true)
    try {
      await updateServiceWorker(true)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <output
      className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg md:bottom-6"
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        新しいバージョンがあります
      </p>
      <Button size="sm" disabled={updating} onClick={() => void applyUpdate()}>
        {updating ? "再読み込み中" : "再読み込み"}
      </Button>
      <button
        className="shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        type="button"
        aria-label="更新通知を閉じる"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </button>
    </output>
  )
}

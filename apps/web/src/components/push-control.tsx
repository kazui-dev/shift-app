import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"

import { errorMessage } from "@/api/client"
import {
  base64UrlBytes,
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/api/push"
import { FeedbackNotice } from "@/components/feedback-notice"
import { useOfflineMode } from "@/components/offline-mode-context"

export function PushControl() {
  const offline = useOfflineMode()
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(subscription !== null))
  }, [supported])

  async function toggle() {
    setPending(true)
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      if (current) {
        await removePushSubscription(current.endpoint)
        await current.unsubscribe()
        setEnabled(false)
        setMessage("通知を解除しました。")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setMessage("通知が許可されていません。")
        return
      }
      const { publicKey } = await getPushConfig()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlBytes(publicKey),
      })
      try {
        await savePushSubscription(subscription.toJSON())
      } catch (error) {
        await subscription.unsubscribe()
        throw error
      }
      setEnabled(true)
      setMessage("シフト通知を有効にしました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  if (!supported) return null

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="シフト通知"
        className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? "bg-foreground" : "bg-muted-foreground/30"} disabled:opacity-50`}
        disabled={pending || offline}
        title={offline ? "オンライン時に変更できます" : undefined}
        onClick={toggle}
      >
        {pending ? (
          <LoaderCircle className="absolute inset-0 m-auto size-4 animate-spin text-background" />
        ) : (
          <span
            className={`absolute top-1 size-5 rounded-full bg-background shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        )}
      </button>
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </>
  )
}

import { useEffect, useState } from "react"
import { Bell, BellOff, LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import {
  base64UrlBytes,
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/api/push"
import { FeedbackNotice } from "@/components/feedback-notice"

export function PushControl() {
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
      <Button size="sm" variant="outline" disabled={pending} onClick={toggle}>
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : enabled ? (
          <BellOff />
        ) : (
          <Bell />
        )}
        {enabled ? "通知中" : "通知"}
      </Button>
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </>
  )
}

import { useEffect, useState } from "react"
import { Bell, BellOff, LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import {
  base64UrlBytes,
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/api/push"
import { useOfflineMode } from "@/components/offline-mode-context"

export function PushControl() {
  const offline = useOfflineMode()
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supported) return
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(subscription !== null))
  }, [supported])

  async function toggle() {
    setPending(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      if (current) {
        await removePushSubscription(current.endpoint)
        await current.unsubscribe()
        setEnabled(false)
        toast.success("通知を解除しました。")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        toast.error("通知が許可されていません。")
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
      toast.success("通知を有効にしました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  if (!supported) return null

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || offline}
        title={offline ? "オンライン時に変更できます" : undefined}
        onClick={toggle}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : enabled ? (
          <BellOff />
        ) : (
          <Bell />
        )}
        {enabled ? "通知中" : "通知"}
      </Button>
    </>
  )
}

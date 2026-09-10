import { useSyncExternalStore } from "react"

import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import {
  base64UrlBytes,
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/api/push"
import { useOfflineMode } from "@/components/offline-mode-context"
import {
  confirmPushControlState,
  getPushControlState,
  pushNotificationsSupported,
  requestPushControlState,
  rollbackPushControlState,
  subscribePushControl,
} from "@/lib/push-control-store"

export function PushControl() {
  const offline = useOfflineMode()
  const supported = pushNotificationsSupported()
  const state = useSyncExternalStore(subscribePushControl, getPushControlState)

  async function toggle(nextEnabled: boolean) {
    if (
      state.enabled === null ||
      state.pending ||
      nextEnabled === state.enabled
    ) {
      return
    }
    requestPushControlState(nextEnabled)
    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      if (!nextEnabled) {
        if (current) {
          await removePushSubscription(current.endpoint)
          await current.unsubscribe()
        }
        confirmPushControlState()
        toast.success("通知を解除しました。")
        return
      }
      if (current) {
        await savePushSubscription(current.toJSON())
        confirmPushControlState()
        toast.success("通知を有効にしました。")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        rollbackPushControlState()
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
      confirmPushControlState()
      toast.success("通知を有効にしました。")
    } catch (error) {
      rollbackPushControlState()
      toast.error(errorMessage(error))
    }
  }

  if (!supported) return null

  return (
    <Switch
      id="push-notifications"
      aria-label="通知"
      aria-busy={state.pending}
      checked={state.enabled ?? false}
      disabled={state.enabled === null || state.pending || offline}
      title={offline ? "オンライン時に変更できます" : undefined}
      onCheckedChange={(checked) => void toggle(checked)}
    />
  )
}

import { useEffect, useReducer } from "react"

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
  pushControlInitialState,
  reducePushControl,
} from "@/lib/push-control-state"

export function PushControl() {
  const offline = useOfflineMode()
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  const [state, dispatch] = useReducer(
    reducePushControl,
    pushControlInitialState
  )

  useEffect(() => {
    if (!supported) return
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) =>
        dispatch({ type: "loaded", enabled: subscription !== null })
      )
      .catch(() => dispatch({ type: "loaded", enabled: false }))
  }, [supported])

  async function toggle(nextEnabled: boolean) {
    if (
      state.enabled === null ||
      state.pending ||
      nextEnabled === state.enabled
    ) {
      return
    }
    dispatch({ type: "toggle", enabled: nextEnabled })
    try {
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      if (!nextEnabled) {
        if (current) {
          await removePushSubscription(current.endpoint)
          await current.unsubscribe()
        }
        dispatch({ type: "success" })
        toast.success("通知を解除しました。")
        return
      }
      if (current) {
        await savePushSubscription(current.toJSON())
        dispatch({ type: "success" })
        toast.success("通知を有効にしました。")
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        dispatch({ type: "failure" })
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
      dispatch({ type: "success" })
      toast.success("通知を有効にしました。")
    } catch (error) {
      dispatch({ type: "failure" })
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

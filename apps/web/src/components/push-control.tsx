import { useEffect, useSyncExternalStore } from "react"

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
  getPushControlState,
  pushNotificationsSupported,
  requestPushControlState,
  subscribePushControl,
  synchronizePushControl,
} from "@/lib/push-control-store"

async function syncSubscription(enabled: boolean): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const current = await registration.pushManager.getSubscription()
  if (!enabled) {
    if (current) {
      await removePushSubscription(current.endpoint)
      await current.unsubscribe()
    }
    return
  }
  if (current) {
    await savePushSubscription(current.toJSON())
    return
  }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("通知が許可されていません。")
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
}

function reportSyncFailure(synchronization: Promise<void> | null): void {
  if (!synchronization) return
  void synchronization.catch((error: unknown) =>
    toast.error(errorMessage(error))
  )
}

export function PushControl() {
  const offline = useOfflineMode()
  const supported = pushNotificationsSupported()
  const state = useSyncExternalStore(subscribePushControl, getPushControlState)

  function toggle(nextEnabled: boolean): void {
    if (!requestPushControlState(nextEnabled)) return
    reportSyncFailure(synchronizePushControl(syncSubscription))
  }

  useEffect(() => {
    if (offline) return
    reportSyncFailure(synchronizePushControl(syncSubscription))
  }, [offline])

  if (!supported) return null

  return (
    <Switch
      id="push-notifications"
      aria-label="通知"
      aria-busy={state.syncing}
      checked={state.enabled ?? false}
      disabled={offline}
      title={offline ? "オンライン時に変更できます" : undefined}
      onCheckedChange={toggle}
    />
  )
}

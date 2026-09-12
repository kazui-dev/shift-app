import { watchNotificationPermission } from "@/lib/notification-permission"
import { useOfflineMode } from "./offline-mode-context"
import { useEffect, useSyncExternalStore } from "react"

import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"

import { ApiError, errorMessage } from "@/api/client"
import { syncSubscription } from "@/lib/push-subscription"
import {
  getPushControlState,
  refreshPushControl,
  pushNotificationsSupported,
  requestPushControlState,
  subscribePushControl,
  synchronizePushControl,
} from "@/lib/push-control-store"

function reportSyncFailure(synchronization: Promise<void> | null): void {
  if (!synchronization) return
  void synchronization
    .catch((error: unknown) =>
      toast.error(
        error instanceof DOMException
          ? `通知を登録できませんでした（${error.name}: ${error.message}）`
          : error instanceof Error && !(error instanceof ApiError)
            ? error.message
            : errorMessage(error)
      )
    )
    .finally(refreshPushControl)
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

  useEffect(() => {
    if (!supported) return undefined
    return watchNotificationPermission(() => {
      void refreshPushControl()
    })
  }, [supported])

  if (!supported) return null

  return (
    <Switch
      className="after:right-0"
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

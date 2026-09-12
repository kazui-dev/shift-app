import { useEffect, useSyncExternalStore } from "react"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"
import { useOfflineMode } from "./offline-mode-context"
import { pushSupported } from "@/lib/push-browser"
import {
  getPushControlState,
  setPushEnabled,
  subscribePushControl,
} from "@/lib/push-control-store"

export function PushControl() {
  const offline = useOfflineMode()
  const state = useSyncExternalStore(subscribePushControl, getPushControlState)
  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])
  if (!pushSupported()) return null
  if (state.enabled === null || state.permission === null)
    return <span aria-hidden className="inline-block h-6 w-11 shrink-0" />
  return (
    <Switch
      className="after:right-0 data-disabled:opacity-100"
      id="push-notifications"
      aria-label="通知"
      checked={state.enabled && state.permission === "granted"}
      disabled={offline || state.pending}
      onCheckedChange={(enabled) => {
        void setPushEnabled(enabled)
      }}
    />
  )
}

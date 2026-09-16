import { useEffect, useSyncExternalStore } from "react"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"
import { useOfflineMode } from "./offline-mode-context"
import { pushSupported } from "@/lib/push/browser"
import {
  getPushControlState,
  setPushEnabled,
  subscribePushControl,
} from "@/lib/push/control-store"
import { SettingsRow } from "@/components/settings/section"

export function PushControl() {
  const offline = useOfflineMode()
  const state = useSyncExternalStore(subscribePushControl, getPushControlState)
  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])
  if (!pushSupported()) {
    return (
      <SettingsRow
        label="通知"
        description="この端末では通知を使えません。"
        control={<span aria-hidden className="inline-block h-6 w-11" />}
      />
    )
  }
  return (
    <SettingsRow
      control={
        state.enabled === null ? (
          // The state is settled before this page opens; this is the rare
          // case of a device that has not answered yet.
          <span
            aria-hidden
            className="inline-block h-6 w-11 rounded-full bg-muted"
          />
        ) : (
          <Switch
            className="after:right-0 data-disabled:opacity-100"
            id="push-notifications"
            aria-label="通知"
            checked={state.enabled}
            disabled={offline}
            onCheckedChange={(value) => {
              void setPushEnabled(value)
            }}
          />
        )
      }
    />
  )
}

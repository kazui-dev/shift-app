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

export function PushControl() {
  const offline = useOfflineMode()
  const state = useSyncExternalStore(subscribePushControl, getPushControlState)
  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])
  if (!pushSupported()) return null
  return (
    <div className="flex min-h-18 items-center justify-between gap-4 border-y px-4 py-3 sm:px-6">
      <label htmlFor="push-notifications" className="shrink-0 font-medium">
        通知
      </label>
      {state.enabled === null ? (
        <span aria-hidden className="inline-block h-6 w-11 shrink-0" />
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
      )}
    </div>
  )
}

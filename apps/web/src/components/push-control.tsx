import { RefreshCw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useSyncExternalStore } from "react"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"
import { useOfflineMode } from "./offline-mode-context"
import { watchNotificationPermission } from "@/lib/notification-permission"
import { pushSupported } from "@/lib/push-browser"
import { pushDiagnosticText } from "@/lib/push-diagnostics"
import {
  getPushControlState,
  refreshPushControl,
  setPushEnabled,
  subscribePushControl,
} from "@/lib/push-control-store"

export function PushControl() {
  const offline = useOfflineMode()
  const supported = pushSupported()
  const state = useSyncExternalStore(subscribePushControl, getPushControlState)
  useEffect(() => {
    if (!supported || offline) return undefined
    return watchNotificationPermission(() => {
      void refreshPushControl()
    })
  }, [supported, offline])
  useEffect(() => {
    if (!state.error) return
    const cause = state.error.cause
    const denied =
      cause instanceof DOMException && cause.name === "NotAllowedError"
    toast.error(
      denied
        ? "ブラウザーが通知の購読を許可しませんでした。"
        : state.error.message,
      {
        action: {
          label: "詳細をコピー",
          onClick: () => {
            void navigator.clipboard
              .writeText(pushDiagnosticText())
              .catch(() => toast.error("詳細をコピーできませんでした。"))
          },
        },
      }
    )
  }, [state.error])
  if (!supported) return null
  return (
    <div className="flex items-center gap-2">
      {state.enabled && state.hasSubscription === false && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="通知の接続を再設定"
          title="通知の接続を再設定"
          disabled={offline || state.pending}
          onClick={() => {
            void setPushEnabled(true).catch(() => undefined)
          }}
        >
          <RefreshCw />
        </Button>
      )}
      <Switch
        className={`after:right-0 ${state.enabled === null ? "invisible" : ""}`}
        id="push-notifications"
        aria-label="通知"
        aria-busy={state.pending}
        checked={state.enabled ?? false}
        disabled={offline || state.enabled === null}
        title={
          offline
            ? "オンライン時に変更できます"
            : state.permission === "denied"
              ? "ブラウザーの通知許可がブロックされています"
              : undefined
        }
        onCheckedChange={(enabled) => {
          void setPushEnabled(enabled).catch(() => undefined)
        }}
      />
    </div>
  )
}

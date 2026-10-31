import { useEffect } from "react"
import { useBlocker } from "@tanstack/react-router"
import { ConfirmDialog } from "./confirm-dialog"

/** Route protection stays outside the form so another surface can own closing. */
export function NavigationGuard({
  dirty,
  pending = false,
  allowNavigation,
  title = "未保存の変更を破棄して移動しますか",
}: {
  dirty: boolean
  pending?: boolean
  allowNavigation?: () => boolean
  title?: string
}) {
  const blocker = useBlocker({
    shouldBlockFn: () => !allowNavigation?.() && (dirty || pending),
    enableBeforeUnload: dirty || pending,
    withResolver: true,
  })
  useEffect(() => {
    if (pending && blocker.status === "blocked") blocker.reset()
  }, [pending, blocker])
  return blocker.status === "blocked" && !pending ? (
    <ConfirmDialog
      title={title}
      confirmLabel="移動する"
      onCancel={() => blocker.reset()}
      onConfirm={() => {
        if (!pending) blocker.proceed()
      }}
    />
  ) : null
}

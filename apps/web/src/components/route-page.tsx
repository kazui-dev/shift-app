import { useState, type ReactNode } from "react"
import { useBlocker, useMatch } from "@tanstack/react-router"
import { ResponsivePage } from "@workspace/ui/components/responsive-page"
import { ConfirmDialog } from "@/components/confirm-dialog"

/** Keep the current route mounted until its page has finished closing. */
export function RoutePage({
  children,
  onClose,
  desktop = "dialog",
  path,
  dirty = false,
}: {
  children: ReactNode
  onClose: () => void
  desktop?: "dialog" | "page"
  path?: string
  dirty?: boolean
}) {
  const matchedPath = useMatch({
    strict: false,
    select: (match) => match.pathname,
  })
  const owner = path ?? matchedPath
  const [discard, setDiscard] = useState(false)
  const [finished, setFinished] = useState(false)
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !finished &&
      current.pathname === owner &&
      next.pathname !== owner &&
      !next.pathname.startsWith(`${owner}/`),
    enableBeforeUnload: dirty,
    withResolver: true,
  })
  const confirming = blocker.status === "blocked" && dirty && !discard
  return (
    <ResponsivePage
      desktop={desktop}
      open={!finished && (blocker.status !== "blocked" || confirming)}
      onClose={onClose}
      onClosed={() => {
        if (finished || blocker.status !== "blocked") return
        setFinished(true)
        blocker.proceed()
      }}
    >
      {children}
      {confirming && (
        <ConfirmDialog
          title="変更を破棄しますか"
          description="保存していない変更があります。"
          confirmLabel="破棄して移動"
          onCancel={() => blocker.reset()}
          onConfirm={() => setDiscard(true)}
        />
      )}
    </ResponsivePage>
  )
}

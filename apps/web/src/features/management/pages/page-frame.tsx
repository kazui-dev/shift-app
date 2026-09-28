import { useLayoutEffect, useRef, type ReactNode } from "react"
import { useBlocker } from "@tanstack/react-router"
import { PageHeader } from "@workspace/ui/components/page-header"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useManagement, useManagementScreenView } from "../management-context"

export function ManagementPageFrame({
  title,
  viewKey,
  flushTop = false,
  headerLeading,
  children,
}: {
  title: string
  viewKey: string
  flushTop?: boolean
  headerLeading?: ReactNode
  children: ReactNode
}) {
  const { dirty } = useManagement()
  const view = useManagementScreenView(viewKey)
  const viewport = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = view.scrollTop
  }, [view])
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  })
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader className="sm:px-6">
        {headerLeading}
        <h2 className="flex-1 text-base font-medium">{title}</h2>
      </PageHeader>
      <div
        ref={viewport}
        onScroll={(event) => {
          view.scrollTop = event.currentTarget.scrollTop
        }}
        className={`min-h-0 flex-1 overflow-y-auto px-4 pb-6 [scrollbar-width:none] sm:px-6 lg:px-8 ${flushTop ? "pt-0" : "pt-6"}`}
      >
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
      {blocker.status === "blocked" && (
        <ConfirmDialog
          title="未保存の変更を破棄して移動しますか"
          confirmLabel="移動する"
          onCancel={() => blocker.reset()}
          onConfirm={() => blocker.proceed()}
        />
      )}
    </section>
  )
}

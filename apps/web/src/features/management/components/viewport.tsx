import { ScrollViewport } from "@workspace/ui/components/scroll-viewport"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { useManagement } from "../management-context"

export function ManagementViewport({
  viewKey,
  children,
  width = "contained",
}: {
  viewKey: string
  children: ReactNode
  width?: "contained" | "full"
}) {
  const { screenViews } = useManagement()
  const viewport = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (viewport.current)
      viewport.current.scrollTop = screenViews.get(viewKey) ?? 0
  }, [screenViews, viewKey])
  return (
    <ScrollViewport
      ref={viewport}
      data-slot="management-viewport"
      onScroll={(event) =>
        screenViews.set(viewKey, event.currentTarget.scrollTop)
      }
      contentClassName={width === "contained" ? "mx-auto max-w-6xl" : undefined}
    >
      {children}
    </ScrollViewport>
  )
}

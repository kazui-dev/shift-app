import type { ComponentProps } from "react"
import { cn } from "@workspace/ui/lib/utils"

/** Keep padding in the content so sticky headers can reach the scrollport edge. */
export function ScrollViewport({
  children,
  className,
  contentClassName,
  ...props
}: ComponentProps<"div"> & { contentClassName?: string | undefined }) {
  return (
    <div
      {...props}
      className={cn(
        "min-h-0 min-w-0 flex-1 [scrollbar-width:none] overflow-y-auto",
        className
      )}
    >
      <div className={cn("min-w-0 p-4 sm:p-6", contentClassName)}>
        {children}
      </div>
    </div>
  )
}

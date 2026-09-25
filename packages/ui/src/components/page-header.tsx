import type { ComponentProps } from "react"
import { cn } from "@workspace/ui/lib/utils"

/** Shared frame; callers own heading semantics, navigation and actions. */
export function PageHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex h-15 shrink-0 items-center gap-3 border-b px-4",
        className
      )}
      {...props}
    />
  )
}

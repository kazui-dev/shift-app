import { X } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export function FeedbackNotice({
  message,
  onDismiss,
  tone = "default",
  aboveNavigation = true,
}: {
  message: string
  onDismiss: () => void
  tone?: "default" | "error"
  aboveNavigation?: boolean
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-4 z-50 mx-auto flex max-w-sm items-start gap-3 rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg",
        aboveNavigation
          ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6"
          : "bottom-4",
        tone === "error" && "border-destructive/40"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="min-w-0 flex-1 text-sm leading-relaxed">{message}</p>
      <button
        className="mt-0.5 shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        type="button"
        aria-label="通知を閉じる"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

import { CalendarDays, Shield } from "lucide-react"
import type { ChatTargetOption } from "@workspace/shared/communications"
import { MemberAvatar } from "@/components/member-avatar"
import { cn } from "@workspace/ui/lib/utils"

export function TargetAvatar({
  target,
  className,
}: {
  target: ChatTargetOption
  className?: string
}) {
  if (target.targetType === "member")
    return (
      <MemberAvatar
        name={target.displayName}
        image={target.image}
        className={cn(className)}
      />
    )
  const Icon = target.targetType === "role" ? Shield : CalendarDays
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

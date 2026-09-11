import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

export function MemberAvatar({
  name,
  image,
  className,
}: {
  name: string
  image: string | null
  className?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium",
        className
      )}
    >
      {image && image !== failed ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(image)}
        />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  )
}

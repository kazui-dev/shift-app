import { useEffect, useRef, useState } from "react"
import { ImagePlus, LoaderCircle } from "lucide-react"

import { avatarLimits } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { cn } from "@workspace/ui/lib/utils"

/**
 * The member's profile image with the controls to change it. The chosen file is
 * shown at once; the caller decides when it is sent.
 */
export function AvatarField({
  name,
  image,
  file,
  pending,
  className,
  children,
  onPick,
}: {
  name: string
  image: string | null
  file: File | null
  pending: boolean
  className?: string
  children?: React.ReactNode
  onPick: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : null
    setPreview(url)
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  function choose(chosen: File | undefined) {
    if (!chosen) return
    if (chosen.size > avatarLimits.bytes) {
      toast.error("画像が大きすぎます。別の画像を選んでください。")
      return
    }
    onPick(chosen)
  }

  const shown = preview ?? image
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-medium text-muted-foreground">
        {shown ? (
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          name.slice(0, 1)
        )}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          choose(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          {shown ? "画像を変える" : "画像を選ぶ"}
        </Button>
        {children}
      </div>
    </div>
  )
}

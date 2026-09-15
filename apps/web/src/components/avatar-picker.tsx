import { useRef, type ReactElement } from "react"

import { avatarLimits } from "@workspace/shared/auth"
import { toast } from "@workspace/ui/lib/toast"

/**
 * Choosing a profile image from the device. The caller renders `input` once and
 * calls `open` from whatever control it shows; files too large never reach it.
 */
export function useAvatarPicker(onPick: (file: File) => void): {
  open: () => void
  input: ReactElement
} {
  const element = useRef<HTMLInputElement>(null)
  return {
    open: () => element.current?.click(),
    input: (
      <input
        ref={element}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          event.target.value = ""
          if (!chosen) return
          if (chosen.size > avatarLimits.bytes) {
            toast.error("画像が大きすぎます。別の画像を選んでください。")
            return
          }
          onPick(chosen)
        }}
      />
    ),
  }
}

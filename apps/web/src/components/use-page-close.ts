import { useState } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"

export function usePageClose(
  onClosed: () => void,
  desktop: "dialog" | "page" = "dialog"
) {
  const [open, setOpen] = useState(true)
  const inline = useMediaQuery("(min-width: 768px)") && desktop === "page"
  return {
    open,
    close: () => {
      if (inline) onClosed()
      else setOpen(false)
    },
    onClosed,
  }
}

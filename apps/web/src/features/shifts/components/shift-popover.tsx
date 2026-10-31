import { Popover, PopoverContent } from "@workspace/ui/components/popover"
import {
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react"
import type { ShiftAnchor } from "./shift-anchor"

export function ShiftPopover({
  anchor,
  onClose,
  children,
  retainOnOutside = false,
  ...props
}: Omit<ComponentProps<typeof PopoverContent>, "anchor"> & {
  anchor: ShiftAnchor
  onClose: () => void
  children: ReactNode
  retainOnOutside?: boolean
}) {
  const outside = useRef(false)
  const popup = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    outside.current = false
    const focus =
      typeof anchor.focus === "function" ? anchor.focus() : anchor.focus
    if (!retainOnOutside && focus?.isConnected)
      popup.current?.focus({ preventScroll: true })
  }, [anchor, retainOnOutside])
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open, details) => {
        if (open) return
        const focus =
          typeof anchor.focus === "function" ? anchor.focus() : anchor.focus
        if (
          retainOnOutside &&
          (details.reason === "outside-press" || details.reason === "focus-out")
        ) {
          details.cancel()
          return
        }
        // Replacing the form can remove its focused control before the new panel receives focus.
        if (
          details.reason === "focus-out" &&
          (document.activeElement === focus ||
            outside.current ||
            document.activeElement === document.body ||
            popup.current?.contains(document.activeElement))
        ) {
          details.cancel()
          return
        }
        outside.current =
          details.reason === "outside-press" || details.reason === "focus-out"
        if (details.reason === "escape-key" && focus?.isConnected)
          focus.focus({ preventScroll: true })
        onClose()
      }}
    >
      <PopoverContent
        ref={popup}
        anchor={anchor.position}
        finalFocus={() =>
          outside.current
            ? false
            : ((typeof anchor.focus === "function"
                ? anchor.focus()
                : anchor.focus) ?? false)
        }
        {...props}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

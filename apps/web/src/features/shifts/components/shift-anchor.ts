import type { MouseEvent } from "react"
import type { PopoverContent } from "@workspace/ui/components/popover"
import type { ComponentProps } from "react"

export type ShiftAnchor = {
  position: ComponentProps<typeof PopoverContent>["anchor"]
  focus: HTMLElement | (() => HTMLElement | null)
}

export const shiftBarStyle = { top: 17, height: 20 }

export function elementAnchor(
  element: HTMLElement,
  focus = element
): ShiftAnchor {
  return { position: element, focus }
}

/** Point at the clicked time, at the same height for existing and new assignments. */
export function clickAnchor(
  event: MouseEvent<HTMLElement>,
  bar?: HTMLElement
): ShiftAnchor {
  const visibleBar = bar?.querySelector<HTMLElement>("[data-shift-bar]") ?? bar
  const element = visibleBar ?? event.currentTarget
  if (event.detail === 0 && visibleBar)
    return elementAnchor(visibleBar, event.currentTarget)
  const rect = element.getBoundingClientRect()
  const x =
    event.detail === 0
      ? 0
      : rect.width
        ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        : 0
  return {
    focus: event.currentTarget,
    position: {
      contextElement: element,
      getBoundingClientRect() {
        const current = element.getBoundingClientRect()
        return new DOMRect(
          current.left + current.width * x,
          current.top + (bar ? 0 : shiftBarStyle.top),
          0,
          bar ? current.height : shiftBarStyle.height
        )
      },
    },
  }
}

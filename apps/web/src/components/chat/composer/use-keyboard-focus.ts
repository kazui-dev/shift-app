import { useEffect, type RefObject } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  keyboardAfterResize,
  type KeyboardState,
} from "@/components/chat/composer/keyboard"

/**
 * On a touch screen the input holds focus only while its keyboard is open.
 * Closing the keyboard ends editing, so a later tap or layout change cannot
 * bring the keyboard back by itself.
 */
export function useKeyboardFocus(input: RefObject<HTMLElement | null>) {
  const touch = useMediaQuery("(pointer: coarse)")
  useEffect(() => {
    const viewport = window.visualViewport
    if (!touch || !viewport) return undefined
    let state: KeyboardState | null = null
    const resize = () => {
      // Pinch zoom also resizes the visual viewport; only the keyboard counts.
      if (viewport.scale !== 1) return
      const next = keyboardAfterResize(state, viewport)
      if (state?.open && !next.open && document.activeElement === input.current)
        input.current?.blur()
      state = next
    }
    resize()
    viewport.addEventListener("resize", resize)
    return () => viewport.removeEventListener("resize", resize)
  }, [touch, input])
}

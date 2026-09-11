import { useLayoutEffect, useRef } from "react"
import { useMediaQuery } from "./use-media-query"

// Keyboard geometry is independent from navigation and composer layout.
export function useChatViewport(isChat: boolean) {
  const mobile = useMediaQuery("(max-width: 767px)")
  const shell = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = shell.current
    if (!element || !isChat || !mobile) return undefined
    const viewport = window.visualViewport
    const measure = () => {
      if (viewport && viewport.scale === 1) {
        element.style.setProperty(
          "--chat-viewport-height",
          `${viewport.height}px`
        )
        element.style.setProperty(
          "--chat-viewport-top",
          `${viewport.offsetTop}px`
        )
      }
    }
    measure()
    viewport?.addEventListener("resize", measure)
    viewport?.addEventListener("scroll", measure)
    return () => {
      viewport?.removeEventListener("resize", measure)
      viewport?.removeEventListener("scroll", measure)
      element.style.removeProperty("--chat-viewport-height")
      element.style.removeProperty("--chat-viewport-top")
    }
  }, [isChat, mobile])
  return shell
}

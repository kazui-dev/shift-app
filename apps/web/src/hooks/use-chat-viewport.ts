import { useEffect, useRef, useState } from "react"
import { useMediaQuery } from "./use-media-query"

// One owner for the visible chat area and the navigation while composing.
export function useChatViewport(isChat: boolean) {
  const mobile = useMediaQuery("(max-width: 767px)")
  const shell = useRef<HTMLDivElement>(null)
  const [composing, setComposing] = useState(false)
  useEffect(() => {
    const element = shell.current
    if (!element || !isChat || !mobile) return undefined
    const viewport = window.visualViewport
    let frame = 0
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
    const focus = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setComposing(!!document.activeElement?.closest("[data-chat-composer]"))
        measure()
      })
    }
    measure()
    focus()
    document.addEventListener("focusin", focus)
    document.addEventListener("focusout", focus)
    viewport?.addEventListener("resize", measure)
    viewport?.addEventListener("scroll", measure)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("focusin", focus)
      document.removeEventListener("focusout", focus)
      viewport?.removeEventListener("resize", measure)
      viewport?.removeEventListener("scroll", measure)
      element.style.removeProperty("--chat-viewport-height")
      element.style.removeProperty("--chat-viewport-top")
      setComposing(false)
    }
  }, [isChat, mobile])
  return { shell, composing: isChat && mobile && composing }
}

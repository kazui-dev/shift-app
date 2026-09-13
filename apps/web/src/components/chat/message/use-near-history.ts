import { useEffect, useState, type RefObject } from "react"

/**
 * Whether the element is within `screens` screens of the visible chat history.
 * Measured against the history's own scroll box: against the page viewport, a
 * margin cannot reach past the history's clipping, so nothing loads early.
 */
export function useNearHistory(
  target: RefObject<Element | null>,
  screens: number
) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = target.current
    if (!element) return undefined
    const observer = new IntersectionObserver(
      (entries) => setNear(entries.at(-1)?.isIntersecting ?? false),
      {
        root: element.closest("[data-chat-history]"),
        rootMargin: `${screens * 100}% 0px`,
      }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [target, screens])
  return near
}

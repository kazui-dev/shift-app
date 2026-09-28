import { useEffect, useState, type RefObject } from "react"

type Watch = (near: boolean) => void
type SharedObserver = {
  observer: IntersectionObserver
  watches: Map<Element, Watch>
}

/** One observer per history and distance, shared by every element it watches. */
const observers = new WeakMap<Element | Document, Map<number, SharedObserver>>()

function shared(root: Element | null, screens: number) {
  const key = root ?? document
  const byDistance = observers.get(key) ?? new Map<number, SharedObserver>()
  observers.set(key, byDistance)
  const existing = byDistance.get(screens)
  if (existing) return existing
  const watches = new Map<Element, Watch>()
  const created = {
    watches,
    observer: new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          watches.get(entry.target)?.(entry.isIntersecting)
      },
      { root, rootMargin: `${screens * 100}% 0px` }
    ),
  }
  byDistance.set(screens, created)
  return created
}

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
    const { observer, watches } = shared(
      element.closest("[data-chat-history]"),
      screens
    )
    watches.set(element, setNear)
    observer.observe(element)
    return () => {
      observer.unobserve(element)
      watches.delete(element)
    }
  }, [target, screens])
  return near
}

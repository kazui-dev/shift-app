import { useEffect, useState, type RefObject } from "react"

type Watch = (near: boolean) => void
type SharedObserver = {
  observer: IntersectionObserver
  resize: ResizeObserver | null
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
  // IntersectionObserver percentage margins are relative to width, not height.
  let margin = (root?.clientHeight ?? window.innerHeight) * screens
  const create = () =>
    new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          watches.get(entry.target)?.(entry.isIntersecting)
      },
      { root, rootMargin: `${margin}px 0px` }
    )
  const created: SharedObserver = { watches, observer: create(), resize: null }
  if (root) {
    created.resize = new ResizeObserver(() => {
      const next = root.clientHeight * screens
      if (next === margin) return
      margin = next
      created.observer.disconnect()
      created.observer = create()
      for (const element of watches.keys()) created.observer.observe(element)
    })
    created.resize.observe(root)
  }
  byDistance.set(screens, created)
  return created
}

/** Starts images about two viewport heights ahead, including on tall phones. */
export function useNearHistory(
  target: RefObject<Element | null>,
  screens: number
) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = target.current
    if (!element) return undefined
    const root = element.closest("[data-chat-history]")
    const watch = shared(root, screens)
    watch.watches.set(element, setNear)
    watch.observer.observe(element)
    return () => {
      watch.observer.unobserve(element)
      watch.watches.delete(element)
      if (!watch.watches.size) {
        watch.observer.disconnect()
        watch.resize?.disconnect()
        observers.get(root ?? document)?.delete(screens)
      }
    }
  }, [target, screens])
  return near
}

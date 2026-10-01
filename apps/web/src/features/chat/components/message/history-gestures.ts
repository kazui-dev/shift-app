import { createContext, useEffect, useMemo, type RefObject } from "react"

type Handlers = {
  reset: (event: PointerEvent) => void
  pointerdown: (event: PointerEvent) => void
  pointermove: (event: PointerEvent) => void
  pointerup: () => void
  pointercancel: () => void
  contextmenu: (event: MouseEvent) => void
  click: (event: MouseEvent) => void
  keydown: (event: KeyboardEvent) => void
}
type Registry = Map<HTMLElement, Handlers>
export const HistoryGestures = createContext<Registry | null>(null)

/** One set of delegated listeners per mounted history, independent of row count. */
export function useHistoryGestures(viewport: RefObject<HTMLElement | null>) {
  const registry = useMemo<Registry>(() => new Map(), [])
  useEffect(() => {
    const root = viewport.current
    if (!root) return undefined
    const find = (event: Event) => {
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-message-actions]")
          : null
      return element ? registry.get(element) : undefined
    }
    const reset = (event: PointerEvent) => {
      for (const handlers of registry.values()) handlers.reset(event)
    }
    let pressed: Handlers | undefined
    const down = (event: PointerEvent) => {
      pressed = find(event)
      pressed?.pointerdown(event)
    }
    const move = (event: PointerEvent) => pressed?.pointermove(event)
    const up = () => {
      pressed?.pointerup()
      pressed = undefined
    }
    const cancel = () => {
      pressed?.pointercancel()
      pressed = undefined
    }
    const context = (event: MouseEvent) => find(event)?.contextmenu(event)
    const click = (event: MouseEvent) => find(event)?.click(event)
    const key = (event: KeyboardEvent) => find(event)?.keydown(event)
    document.addEventListener("pointerdown", reset, true)
    root.addEventListener("pointerdown", down)
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", up)
    document.addEventListener("pointercancel", cancel)
    root.addEventListener("contextmenu", context)
    root.addEventListener("click", click, true)
    root.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("pointerdown", reset, true)
      root.removeEventListener("pointerdown", down)
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", up)
      document.removeEventListener("pointercancel", cancel)
      root.removeEventListener("contextmenu", context)
      root.removeEventListener("click", click, true)
      root.removeEventListener("keydown", key)
    }
  }, [viewport, registry])
  return registry
}

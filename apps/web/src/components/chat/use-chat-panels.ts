import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react"
import useEmblaCarousel from "embla-carousel-react"
import { useMediaQuery } from "@/hooks/use-media-query"

export function useChatPanels({
  showingRoom,
  hasRoom,
  onBack,
  onResume,
}: {
  showingRoom: boolean
  hasRoom: boolean
  onBack: () => void
  onResume: () => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const initial = useRef(showingRoom ? 1 : 0)
  const requested = useRef(initial.current)
  const list = useRef<HTMLElement>(null)
  const conversation = useRef<HTMLDivElement>(null)
  const available = useRef(hasRoom)
  useLayoutEffect(() => {
    available.current = hasRoom
  }, [hasRoom])
  const watchDrag = useCallback(
    (_api: unknown, event: MouseEvent | TouchEvent) => {
      if (!(event instanceof TouchEvent) || !available.current) return false
      const touch = event.touches.item(0)
      if (
        !touch ||
        touch.clientX < 24 ||
        touch.clientX > window.innerWidth - 24
      )
        return false
      if (window.getSelection()?.toString()) return false
      return !(
        event.target instanceof Element &&
        event.target.closest(
          "form,input,textarea,button,select,[contenteditable=true],[role=dialog]"
        )
      )
    },
    []
  )
  const [viewport, api] = useEmblaCarousel({
    active: !desktop,
    align: "start",
    containScroll: false,
    startIndex: initial.current,
    watchDrag,
    watchFocus: false,
    duration: reducedMotion ? 0 : 20,
  })
  const activate = useEffectEvent((next: number) => {
    const hidden = next === 1 ? list.current : conversation.current
    if (
      !desktop &&
      document.activeElement instanceof HTMLElement &&
      hidden?.contains(document.activeElement)
    )
      document.activeElement.blur()
    if (list.current) list.current.inert = !desktop && next === 1
    if (conversation.current)
      conversation.current.inert = !desktop && next === 0
  })
  const select = useEffectEvent(() => {
    if (!api) return
    const next = api.selectedScrollSnap()
    activate(next)
    if (next === requested.current) return
    requested.current = next
    if (next === 0) onBack()
    else onResume()
  })
  useEffect(() => {
    if (!api || desktop) return undefined
    const element = list.current
    const paint = () => {
      if (element)
        element.style.transform = `translate3d(${api.scrollProgress() * 75}%,0,0)`
    }
    const reInit = () => {
      api.scrollTo(requested.current, true)
      paint()
    }
    api.on("select", select)
    api.on("scroll", paint)
    api.on("reInit", reInit)
    reInit()
    return () => {
      api.off("select", select)
      api.off("scroll", paint)
      api.off("reInit", reInit)
      element?.style.removeProperty("transform")
    }
  }, [api, desktop])
  useLayoutEffect(() => {
    const next = showingRoom ? 1 : 0
    requested.current = next
    activate(next)
    // A route acknowledgement must not restart a gesture already moving away.
    if (!desktop && api && api.selectedScrollSnap() !== next)
      api.scrollTo(next, reducedMotion)
  }, [api, showingRoom, desktop, reducedMotion])
  return { viewport, list, conversation }
}

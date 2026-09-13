import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react"
import { pageDrag, boundPages } from "@/components/chat/page-motion"
import useEmblaCarousel from "embla-carousel-react"
import { useMediaQuery } from "@/hooks/use-media-query"

export function useChatPanels({
  showingRoom,
  hasRoom,
  showingMembers,
  onMembers,
  onConversation,
  onBack,
  onResume,
}: {
  showingRoom: boolean
  hasRoom: boolean
  showingMembers: boolean
  onMembers: () => void
  onConversation: () => void
  onBack: () => void
  onResume: () => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const initial = useRef(showingRoom ? (showingMembers ? 2 : 1) : 0)
  const requested = useRef(initial.current)
  const list = useRef<HTMLElement>(null)
  const conversation = useRef<HTMLDivElement>(null)
  const members = useRef<HTMLElement>(null)
  const available = useRef(hasRoom)
  useLayoutEffect(() => {
    available.current = hasRoom
  }, [hasRoom])
  const watchDrag = useCallback(
    (_api: unknown, event: MouseEvent | TouchEvent) => {
      return available.current && pageDrag(event)
    },
    []
  )
  const [viewport, api] = useEmblaCarousel({
    active: !desktop,
    align: "start",
    slides: "[data-chat-panel]",
    containScroll: false,
    startIndex: initial.current,
    watchDrag,
    watchFocus: false,
    duration: reducedMotion ? 0 : 20,
  })
  const activate = useEffectEvent((next: number) => {
    for (const [index, element] of [
      list.current,
      conversation.current,
      members.current,
    ].entries()) {
      const hidden = !desktop && index !== next
      if (
        hidden &&
        document.activeElement instanceof HTMLElement &&
        element?.contains(document.activeElement)
      )
        document.activeElement.blur()
      if (element) element.inert = hidden
    }
  })
  const select = useEffectEvent(() => {
    if (!api) return
    const next = api.selectedScrollSnap()
    activate(next)
    if (next === requested.current) return
    requested.current = next
    if (next === 0) onBack()
    else if (next === 2) onMembers()
    else {
      onConversation()
      if (!showingRoom) onResume()
    }
  })
  useEffect(() => {
    if (!api || desktop) return undefined
    const element = list.current
    let restoreBounds: (() => void) | undefined
    const paint = () => {
      if (element)
        element.style.transform = `translate3d(${api.scrollProgress() * (api.scrollSnapList().length - 1) * 75}%,0,0)`
    }
    const reInit = () => {
      restoreBounds?.()
      restoreBounds = boundPages(api)
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
      restoreBounds?.()
      element?.style.removeProperty("transform")
    }
  }, [api, desktop])
  useLayoutEffect(() => {
    const next = showingRoom ? (showingMembers ? 2 : 1) : 0
    requested.current = next
    activate(next)
    // A route acknowledgement must not restart a gesture already moving away.
    if (!desktop && api && api.selectedScrollSnap() !== next)
      api.scrollTo(next, reducedMotion)
  }, [api, showingRoom, showingMembers, desktop, reducedMotion])
  return { viewport, list, conversation, members }
}

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { swipeDestination, type ChatPanel } from "./swipe"

type Gesture = {
  id: number
  x: number
  y: number
  lastX: number
  lastTime: number
  velocity: number
  width: number
  start: ChatPanel
  locked: boolean
}

export function ChatPanels({
  showingRoom,
  hasRoom,
  list,
  children,
  onBack,
  onResume,
}: {
  showingRoom: boolean
  hasRoom: boolean
  list: ReactNode
  children: ReactNode
  onBack: () => void
  onResume: () => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const viewport = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const listPanel = useRef<HTMLElement>(null)
  const suppressClick = useRef(false)
  const first = useRef(true)
  const previousDesktop = useRef(desktop)
  const paint = useCallback(
    (position: number, animate: boolean) => {
      const transition =
        animate && !reducedMotion
          ? "transform 220ms cubic-bezier(.2,.8,.2,1)"
          : "none"
      if (track.current) {
        track.current.style.transition = transition
        track.current.style.transform = desktop
          ? "none"
          : `translate3d(${-position * 100}%,0,0)`
      }
      if (listPanel.current) {
        listPanel.current.style.transition = transition
        listPanel.current.style.transform = desktop
          ? "none"
          : `translate3d(${position * 75}%,0,0)`
      }
    },
    [desktop, reducedMotion]
  )
  useLayoutEffect(() => {
    paint(
      showingRoom ? 1 : 0,
      !first.current && previousDesktop.current === desktop
    )
    first.current = false
    previousDesktop.current = desktop
  }, [showingRoom, desktop, paint])
  const navigate = useEffectEvent((destination: ChatPanel) => {
    if (destination === 0 && showingRoom) onBack()
    else if (destination === 1 && !showingRoom) onResume()
  })
  useEffect(() => {
    const root = viewport.current
    if (!root || desktop) return undefined
    let gesture: Gesture | null = null
    const down = (event: PointerEvent) => {
      suppressClick.current = false
      if (
        !hasRoom ||
        !event.isPrimary ||
        event.pointerType !== "touch" ||
        event.clientX < 24 ||
        event.clientX > window.innerWidth - 24
      )
        return
      if (
        event.target instanceof Element &&
        event.target.closest(
          "form,input,textarea,button,select,[contenteditable=true],[role=dialog]"
        )
      )
        return
      if (window.getSelection()?.toString()) return
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        width: root.clientWidth,
        start: showingRoom ? 1 : 0,
        locked: false,
      }
    }
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return
      const dx = event.clientX - gesture.x,
        dy = event.clientY - gesture.y
      if (!gesture.locked) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
        if (Math.abs(dy) >= Math.abs(dx)) {
          gesture = null
          return
        }
        gesture.locked = true
        root.setPointerCapture(event.pointerId)
      }
      event.preventDefault()
      const elapsed = event.timeStamp - gesture.lastTime
      if (elapsed > 0)
        gesture.velocity = (event.clientX - gesture.lastX) / elapsed
      gesture.lastX = event.clientX
      gesture.lastTime = event.timeStamp
      paint(Math.max(0, Math.min(1, gesture.start - dx / gesture.width)), false)
    }
    const finish = (event: PointerEvent) => {
      if (event.type === "lostpointercapture" && event.target !== root) return
      if (!gesture || event.pointerId !== gesture.id) return
      const current = gesture
      gesture = null
      if (root.hasPointerCapture(event.pointerId))
        root.releasePointerCapture(event.pointerId)
      if (!current.locked) return
      suppressClick.current = true
      const velocity =
        event.timeStamp - current.lastTime > 100 ? 0 : current.velocity
      const destination =
        event.type === "pointerup"
          ? swipeDestination(
              current.start,
              event.clientX - current.x,
              current.width,
              velocity
            )
          : current.start
      paint(destination, true)
      navigate(destination)
    }
    const click = (event: MouseEvent) => {
      if (!suppressClick.current) return
      suppressClick.current = false
      event.preventDefault()
      event.stopPropagation()
    }
    root.addEventListener("pointerdown", down)
    root.addEventListener("pointermove", move)
    root.addEventListener("pointerup", finish)
    root.addEventListener("pointercancel", finish)
    root.addEventListener("lostpointercapture", finish)
    root.addEventListener("click", click, true)
    return () => {
      root.removeEventListener("pointerdown", down)
      root.removeEventListener("pointermove", move)
      root.removeEventListener("pointerup", finish)
      root.removeEventListener("pointercancel", finish)
      root.removeEventListener("lostpointercapture", finish)
      root.removeEventListener("click", click, true)
    }
  }, [desktop, hasRoom, showingRoom, paint])
  return (
    <section
      ref={viewport}
      aria-label="チャット"
      className="min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      <div
        ref={track}
        className="flex h-full min-h-0 touch-pan-y touch-pinch-zoom md:grid md:grid-cols-[17rem_minmax(0,1fr)]"
      >
        <aside
          ref={listPanel}
          aria-label="ルーム一覧"
          inert={!desktop && showingRoom}
          className="flex min-h-0 min-w-0 flex-[0_0_100%] flex-col md:pr-3"
        >
          {list}
        </aside>
        <div
          inert={!desktop && !showingRoom}
          data-chat-panel="conversation"
          className="relative z-10 flex min-h-0 min-w-0 flex-[0_0_100%] flex-col bg-background md:border-l"
        >
          {children}
        </div>
      </div>
    </section>
  )
}

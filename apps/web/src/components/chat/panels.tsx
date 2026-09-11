import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { swipeDestination, swipeIntent, type ChatPanel } from "./swipe"

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
  navigation,
  children,
  onBack,
  onResume,
}: {
  showingRoom: boolean
  hasRoom: boolean
  list: ReactNode
  navigation: ReactNode
  children: ReactNode
  onBack: () => void
  onResume: () => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const viewport = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const listPanel = useRef<HTMLElement>(null)
  const conversationPanel = useRef<HTMLDivElement>(null)
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
    const hidden = showingRoom ? listPanel.current : conversationPanel.current
    if (
      !desktop &&
      document.activeElement instanceof HTMLElement &&
      hidden?.contains(document.activeElement)
    )
      document.activeElement.blur()
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
    const cancel = () => {
      if (gesture?.locked) paint(gesture.start, true)
      gesture = null
    }
    const down = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancel()
        return
      }
      const touch = event.touches.item(0)
      if (
        !touch ||
        !hasRoom ||
        touch.clientX < 24 ||
        touch.clientX > window.innerWidth - 24
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
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        lastX: touch.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        width: root.clientWidth,
        start: showingRoom ? 1 : 0,
        locked: false,
      }
    }
    const move = (event: TouchEvent) => {
      if (!gesture) return
      const touch = Array.from(event.touches).find(
        (item) => item.identifier === gesture?.id
      )
      if (!touch || event.touches.length !== 1) {
        cancel()
        return
      }
      const dx = touch.clientX - gesture.x,
        dy = touch.clientY - gesture.y
      if (!gesture.locked) {
        const intent = swipeIntent(gesture.start, dx, dy)
        if (intent === "pending") return
        if (intent === "native") {
          gesture = null
          return
        }
        gesture.locked = true
      }
      // Only an accepted horizontal swipe belongs to the app. Cancel the
      // browser's touch gesture itself, not just its derived pointer event.
      if (!event.cancelable) {
        cancel()
        return
      }
      event.preventDefault()
      const elapsed = event.timeStamp - gesture.lastTime
      if (elapsed > 0)
        gesture.velocity = (touch.clientX - gesture.lastX) / elapsed
      gesture.lastX = touch.clientX
      gesture.lastTime = event.timeStamp
      paint(Math.max(0, Math.min(1, gesture.start - dx / gesture.width)), false)
    }
    const finish = (event: TouchEvent) => {
      if (!gesture) return
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === gesture?.id
      )
      if (!touch) return
      const current = gesture
      gesture = null
      if (!current.locked) return
      const velocity =
        event.timeStamp - current.lastTime > 100 ? 0 : current.velocity
      const destination = swipeDestination(
        current.start,
        touch.clientX - current.x,
        current.width,
        velocity
      )
      paint(destination, true)
      navigate(destination)
    }
    root.addEventListener("touchstart", down, { passive: true })
    root.addEventListener("touchmove", move, { passive: false })
    root.addEventListener("touchend", finish, { passive: true })
    root.addEventListener("touchcancel", cancel, { passive: true })
    return () => {
      root.removeEventListener("touchstart", down)
      root.removeEventListener("touchmove", move)
      root.removeEventListener("touchend", finish)
      root.removeEventListener("touchcancel", cancel)
    }
  }, [desktop, hasRoom, showingRoom, paint])
  return (
    <section
      ref={viewport}
      aria-label="チャット"
      className="min-h-0 min-w-0 flex-1 overflow-clip"
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
          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 md:px-0">
            {list}
          </div>
          {navigation}
        </aside>
        <div
          inert={!desktop && !showingRoom}
          ref={conversationPanel}
          data-chat-panel="conversation"
          className="relative z-10 flex min-h-0 min-w-0 flex-[0_0_100%] flex-col bg-background px-4 pb-[env(safe-area-inset-bottom)] sm:px-6 md:border-l md:px-0 md:pb-0"
        >
          {children}
        </div>
      </div>
    </section>
  )
}

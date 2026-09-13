import { useEffect, useRef, useState } from "react"
import { japanDateMinute } from "@workspace/shared/japan-time"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@workspace/ui/components/dialog"
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Download,
  X,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { MemberAvatar } from "@/components/member-avatar"
import {
  initialImageView,
  limitImageView,
  zoomImage,
  type Point,
} from "@/components/chat/image/zoom"

type ViewerImage = {
  id: string
  width: number
  height: number
  /** The object URL once loaded, `null` when it could not be loaded. */
  src: string | null | undefined
}

const ease = "cubic-bezier(.2,.8,.2,1)"

export function ImageViewer({
  images,
  initialIndex,
  onIndexChange,
  onClose,
  caption,
}: {
  images: ViewerImage[]
  initialIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
  caption: {
    author: string
    image: string | null
    content: string
    createdAt: string
  }
}) {
  const frame = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const current = useRef(initialImageView)
  const [view, setView] = useState(initialImageView)
  // Taps and buttons ease between sizes; dragging and pinching follow the finger.
  const [easing, setEasing] = useState(false)
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [index, setIndex] = useState(initialIndex)
  // The strip follows a swipe by `offset` pixels, then slides to `settling`.
  const [offset, setOffset] = useState(0)
  const [sliding, setSliding] = useState(false)
  const settling = useRef<number | null>(null)
  const swipe = useRef<{
    id: number
    x: number
    y: number
    horizontal: boolean | null
  } | null>(null)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)
  const image = images[index]
  const count = images.length

  function resetZoom() {
    pointers.current.clear()
    current.current = initialImageView
    setView(initialImageView)
  }
  useEffect(() => {
    const element = frame.current
    if (!element) return undefined
    const observer = new ResizeObserver(resetZoom)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** Slides to `target`, from wherever a swipe left the strip. */
  function go(target: number) {
    const width = frame.current?.clientWidth ?? 0
    if (target < 0 || target >= count || target === index) {
      setSliding(!reducedMotion)
      setOffset(0)
      return
    }
    if (reducedMotion || !width) {
      finish(target)
      return
    }
    settling.current = target
    setSliding(true)
    setOffset((index - target) * width)
  }
  function finish(target: number) {
    settling.current = null
    setSliding(false)
    setOffset(0)
    setIndex(target)
    resetZoom()
    onIndexChange(target)
  }
  const previous = index > 0 ? () => go(index - 1) : undefined
  const next = index < count - 1 ? () => go(index + 1) : undefined

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const move =
        event.key === "ArrowLeft"
          ? previous
          : event.key === "ArrowRight"
            ? next
            : undefined
      if (!move) return
      event.preventDefault()
      move()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  })

  function update(value: typeof view, eased = false) {
    setEasing(eased && !reducedMotion)
    const bounds = frame.current?.getBoundingClientRect()
    if (!bounds || !image) return
    const fit = Math.min(
      bounds.width / image.width,
      bounds.height / image.height
    )
    const limited = limitImageView(
      value,
      bounds.width,
      bounds.height,
      image.width * fit,
      image.height * fit
    )
    current.current = limited
    setView(limited)
  }
  function magnify(factor: number) {
    update(
      zoomImage(current.current, current.current.scale * factor, {
        x: 0,
        y: 0,
      }),
      true
    )
  }
  /** Double tap or double click: zoom in on that point, or back to fit. */
  function toggleZoom(point: Point) {
    update(
      current.current.scale === 1
        ? zoomImage(current.current, 2.5, point)
        : initialImageView,
      true
    )
  }

  const button =
    "pointer-events-auto size-11 rounded-full bg-black/65 text-white hover:bg-white/20"
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black/95 p-0 text-white ring-0 duration-0 sm:max-w-none data-open:animate-none data-closed:animate-none"
      >
        <DialogTitle className="sr-only">
          {caption.author}の添付画像
        </DialogTitle>
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex items-start justify-between px-3 md:justify-end md:gap-3">
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="画像を閉じる"
                className={`${button} md:order-last`}
              />
            }
          >
            <X />
          </DialogClose>
          <div className="pointer-events-auto flex items-center rounded-full bg-black/65 p-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="縮小"
              className="hidden text-white hover:bg-white/20 md:inline-flex"
              disabled={view.scale === 1}
              onClick={() => magnify(1 / 1.5)}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="拡大"
              className="hidden text-white hover:bg-white/20 md:inline-flex"
              disabled={view.scale === 5}
              onClick={() => magnify(1.5)}
            >
              <Plus />
            </Button>
            {image?.src && (
              <a
                href={image.src}
                download="chat-image.webp"
                aria-label="画像を保存"
                className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/20"
              >
                <Download className="size-5" />
              </a>
            )}
          </div>
        </div>
        {count > 1 && (
          <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10 hidden gap-2 md:flex">
            <Button
              variant="ghost"
              size="icon"
              aria-label="前の画像"
              disabled={!previous}
              onClick={previous}
              className={button}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="次の画像"
              disabled={!next}
              onClick={next}
              className={button}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
        <div
          ref={frame}
          className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
          onPointerDown={(event) => {
            if (event.button !== 0 || pointers.current.size >= 2) return
            if (settling.current !== null) finish(settling.current)
            setEasing(false)
            setSliding(false)
            // A single touch at normal size may swipe between images.
            swipe.current =
              pointers.current.size === 0 &&
              event.pointerType !== "mouse" &&
              count > 1
                ? {
                    id: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    horizontal: null,
                  }
                : null
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            })
          }}
          onPointerMove={(event) => {
            const last = pointers.current.get(event.pointerId)
            if (!last) return
            const point = { x: event.clientX, y: event.clientY }
            const other = [...pointers.current].find(
              ([id]) => id !== event.pointerId
            )?.[1]
            pointers.current.set(event.pointerId, point)
            const gesture = swipe.current
            if (
              gesture?.id === event.pointerId &&
              !other &&
              current.current.scale === 1
            ) {
              const dx = point.x - gesture.x,
                dy = point.y - gesture.y
              if (gesture.horizontal === null && Math.hypot(dx, dy) > 8)
                gesture.horizontal = Math.abs(dx) > Math.abs(dy)
              if (gesture.horizontal) {
                // Resist past the first and last image.
                const edge =
                  (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
                setOffset(edge ? dx / 3 : dx)
                return
              }
            }
            if (other) {
              const distance = Math.hypot(last.x - other.x, last.y - other.y)
              if (distance < 1) return
              const bounds = event.currentTarget.getBoundingClientRect()
              const midpoint = (value: Point) => ({
                x: (value.x + other.x) / 2 - bounds.left - bounds.width / 2,
                y: (value.y + other.y) / 2 - bounds.top - bounds.height / 2,
              })
              update(
                zoomImage(
                  current.current,
                  (current.current.scale *
                    Math.hypot(point.x - other.x, point.y - other.y)) /
                    distance,
                  midpoint(last),
                  midpoint(point)
                )
              )
            } else {
              update({
                ...current.current,
                x: current.current.x + point.x - last.x,
                y: current.current.y + point.y - last.y,
              })
            }
          }}
          onLostPointerCapture={(event) =>
            pointers.current.delete(event.pointerId)
          }
          onPointerUp={(event) => {
            const gesture = swipe.current
            swipe.current = null
            const single = pointers.current.size === 1
            pointers.current.delete(event.pointerId)
            if (!single) {
              lastTap.current = null
              return
            }
            if (gesture?.horizontal) {
              lastTap.current = null
              const width = event.currentTarget.clientWidth
              const dx = event.clientX - gesture.x
              go(Math.abs(dx) > width / 5 ? index + (dx < 0 ? 1 : -1) : index)
              return
            }
            const bounds = event.currentTarget.getBoundingClientRect()
            const tap = {
              time: event.timeStamp,
              x: event.clientX,
              y: event.clientY,
            }
            const previousTap = lastTap.current
            if (
              previousTap &&
              tap.time - previousTap.time < 300 &&
              Math.hypot(tap.x - previousTap.x, tap.y - previousTap.y) < 30
            ) {
              lastTap.current = null
              toggleZoom({
                x: tap.x - bounds.left - bounds.width / 2,
                y: tap.y - bounds.top - bounds.height / 2,
              })
              return
            }
            lastTap.current = tap
          }}
          onPointerCancel={(event) => {
            swipe.current = null
            pointers.current.delete(event.pointerId)
            go(index)
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translateX(${offset}px)`,
              transition: sliding ? `transform 260ms ${ease}` : "none",
            }}
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget) return
              if (settling.current !== null) finish(settling.current)
              else setSliding(false)
            }}
          >
            {images.map((item, position) => (
              <div
                key={item.id}
                aria-hidden={position !== index}
                className="absolute inset-0 overflow-hidden"
                style={{
                  transform: `translateX(${(position - index) * 100}%)`,
                }}
              >
                {item.src ? (
                  <img
                    src={item.src}
                    alt={`添付画像${position + 1}`}
                    draggable={false}
                    className="pointer-events-none size-full object-contain"
                    style={
                      position === index
                        ? {
                            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                            transition: easing
                              ? `transform 200ms ${ease}`
                              : "none",
                          }
                        : undefined
                    }
                  />
                ) : (
                  item.src === null && (
                    <p className="flex size-full items-center justify-center text-sm text-white/60">
                      画像を読み込めませんでした
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex max-h-[30dvh] shrink-0 flex-col gap-4 overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] text-sm">
          {count > 1 && (
            <fieldset
              aria-label="画像を選ぶ"
              className="-mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 [scrollbar-width:none]"
            >
              {images.map((item, position) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`画像${position + 1}を表示`}
                  aria-current={position === index}
                  onClick={() => go(position)}
                  className={`size-14 shrink-0 overflow-hidden rounded-md bg-white/10 ring-2 transition-opacity ${position === index ? "opacity-100 ring-white" : "opacity-60 ring-transparent hover:opacity-90"}`}
                >
                  {item.src && (
                    <img
                      src={item.src}
                      alt=""
                      draggable={false}
                      className="size-full object-cover"
                    />
                  )}
                </button>
              ))}
            </fieldset>
          )}
          <div className="flex items-start gap-3">
            <MemberAvatar
              name={caption.author}
              image={caption.image}
              className="size-9 bg-white/15 text-white"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold">{caption.author}</span>
                <time
                  className="text-xs text-white/60"
                  dateTime={caption.createdAt}
                >
                  {japanDateMinute(caption.createdAt)}
                </time>
              </div>
              {caption.content && (
                <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">
                  {caption.content}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

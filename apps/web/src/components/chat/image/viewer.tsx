import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react"
import useEmblaCarousel from "embla-carousel-react"
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
import { thumbnailWidth } from "@/components/chat/image/thumbnail"

type CarouselOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>

type ViewerImage = {
  id: string
  width: number
  height: number
  /** The object URL once loaded, `null` when it could not be loaded. */
  src: string | null | undefined
}

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
  const count = images.length
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const desktop = useMediaQuery("(min-width: 768px)")
  const frame = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const current = useRef(initialImageView)
  const [view, setView] = useState(initialImageView)
  // Taps and buttons ease between sizes; dragging and pinching follow the finger.
  const [easing, setEasing] = useState(false)
  const press = useRef<Point | null>(null)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)

  // Embla owns swiping between images; a zoomed image keeps drags for panning.
  const [options] = useState<CarouselOptions>(() => ({
    startIndex: initialIndex,
    watchDrag: (_api, event) =>
      current.current.scale === 1 &&
      !("touches" in event && event.touches.length > 1),
  }))
  const [viewport, carousel] = useEmblaCarousel({
    ...options,
    duration: reducedMotion ? 10 : 25,
  })
  const [index, setIndex] = useState(initialIndex)
  // The carousel position as a fractional index, so thumbnails follow a swipe.
  const [position, setPosition] = useState(initialIndex)
  const image = images[index]

  function resetZoom() {
    pointers.current.clear()
    current.current = initialImageView
    setView(initialImageView)
  }
  const selected = useEffectEvent((target: number) => {
    setIndex(target)
    resetZoom()
    onIndexChange(target)
  })
  useEffect(() => {
    if (!carousel) return undefined
    const scroll = () =>
      setPosition(carousel.scrollProgress() * Math.max(0, count - 1))
    const select = () => selected(carousel.selectedScrollSnap())
    carousel.on("scroll", scroll).on("reInit", scroll).on("select", select)
    scroll()
    return () => {
      carousel.off("scroll", scroll).off("reInit", scroll).off("select", select)
    }
  }, [carousel, count])
  useEffect(() => {
    const element = frame.current
    if (!element) return undefined
    const observer = new ResizeObserver(resetZoom)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") carousel?.scrollPrev()
      else if (event.key === "ArrowRight") carousel?.scrollNext()
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [carousel])
  const strip = useRef<HTMLFieldSetElement>(null)
  useEffect(() => {
    strip.current?.children[index]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reducedMotion ? "instant" : "smooth",
    })
  }, [index, reducedMotion])

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
  function center(event: PointerEvent<HTMLElement>, point: Point) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: point.x - bounds.left - bounds.width / 2,
      y: point.y - bounds.top - bounds.height / 2,
    }
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
              disabled={index === 0}
              onClick={() => carousel?.scrollPrev()}
              className={button}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="次の画像"
              disabled={index === count - 1}
              onClick={() => carousel?.scrollNext()}
              className={button}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
        <div
          ref={(element) => {
            frame.current = element
            viewport(element)
          }}
          className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
          onPointerDown={(event) => {
            if (event.button !== 0 || pointers.current.size >= 2) return
            setEasing(false)
            press.current = { x: event.clientX, y: event.clientY }
            // Panning a zoomed image keeps the pointer even outside the frame.
            if (current.current.scale > 1)
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
            if (other) {
              const distance = Math.hypot(last.x - other.x, last.y - other.y)
              if (distance < 1) return
              const midpoint = (value: Point) =>
                center(event, {
                  x: (value.x + other.x) / 2,
                  y: (value.y + other.y) / 2,
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
            } else if (current.current.scale > 1) {
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
            const single = pointers.current.size === 1
            pointers.current.delete(event.pointerId)
            const start = press.current
            press.current = null
            const tap = {
              time: event.timeStamp,
              x: event.clientX,
              y: event.clientY,
            }
            if (
              !single ||
              !start ||
              Math.hypot(tap.x - start.x, tap.y - start.y) > 10
            ) {
              lastTap.current = null
              return
            }
            const previousTap = lastTap.current
            if (
              previousTap &&
              tap.time - previousTap.time < 300 &&
              Math.hypot(tap.x - previousTap.x, tap.y - previousTap.y) < 30
            ) {
              lastTap.current = null
              toggleZoom(center(event, tap))
              return
            }
            lastTap.current = tap
          }}
          onPointerCancel={(event) => {
            press.current = null
            pointers.current.delete(event.pointerId)
          }}
        >
          <div className="flex h-full">
            {images.map((item, slide) => (
              <div
                key={item.id}
                aria-hidden={slide !== index}
                className="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden"
              >
                {item.src ? (
                  <img
                    src={item.src}
                    alt={`添付画像${slide + 1}`}
                    draggable={false}
                    className="pointer-events-none size-full object-contain"
                    style={
                      slide === index
                        ? {
                            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                            transition: easing
                              ? "transform 200ms cubic-bezier(.2,.8,.2,1)"
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
        <div className="flex max-h-[30dvh] shrink-0 flex-col gap-4 overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] text-sm">
          {count > 1 && (
            <div
              data-horizontal-scroll
              className="-mx-5 flex justify-center-safe overflow-x-auto px-5 [scrollbar-width:none]"
            >
              <fieldset
                ref={strip}
                aria-label="画像を選ぶ"
                className="m-0 flex w-max min-w-0 items-center gap-1.5 border-0 p-0"
              >
                {images.map((item, thumb) => {
                  // 1 at the image in view, easing to 0 one image away.
                  const focus = Math.max(0, 1 - Math.abs(position - thumb))
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`画像${thumb + 1}を表示`}
                      aria-current={thumb === index}
                      onClick={() => carousel?.scrollTo(thumb)}
                      className="h-14 shrink-0 overflow-hidden rounded-md bg-white/10"
                      style={{
                        width: desktop
                          ? "3.5rem"
                          : `${thumbnailWidth(item, focus)}rem`,
                        opacity: 0.55 + 0.45 * focus,
                      }}
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
                  )
                })}
              </fieldset>
            </div>
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

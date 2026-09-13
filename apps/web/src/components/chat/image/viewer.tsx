import { useEffect, useEffectEvent, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
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
import { ThumbnailStrip } from "@/components/chat/image/thumbnail-strip"
import { useImageGestures } from "@/components/chat/image/use-image-gestures"
import { ViewerCaption } from "@/components/chat/image/viewer-caption"

type CarouselOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>

type ViewerImage = {
  id: string
  name: string
  width: number
  height: number
  /** The object URL once loaded, `null` when it could not be loaded. */
  src: string | null | undefined
  /** The thumbnail's object URL once loaded. */
  thumb: string | undefined
}

export function ImageViewer({
  images,
  initialIndex,
  onIndexChange,
  onSave,
  onClose,
  caption,
}: {
  images: ViewerImage[]
  initialIndex: number
  onIndexChange: (index: number) => void
  onSave: () => void
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
  const [index, setIndex] = useState(initialIndex)
  // The carousel position as a fractional index, so thumbnails follow a swipe.
  const [position, setPosition] = useState(initialIndex)
  const gestures = useImageGestures(images[index], reducedMotion)

  // Embla owns swiping between images; a zoomed image keeps drags for panning.
  // `fitted` reads the gestures' current zoom, so the first render's copy stays true.
  const [options] = useState<CarouselOptions>(() => ({
    startIndex: initialIndex,
    watchDrag: (_api, event) =>
      gestures.fitted() && !("touches" in event && event.touches.length > 1),
  }))
  const [viewport, carousel] = useEmblaCarousel({
    ...options,
    duration: reducedMotion ? 10 : 25,
  })
  const selected = useEffectEvent((target: number) => {
    setIndex(target)
    gestures.reset()
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
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") carousel?.scrollPrev()
      else if (event.key === "ArrowRight") carousel?.scrollNext()
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [carousel])

  const { view, easing } = gestures
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
              onClick={() => gestures.magnify(1 / 1.5)}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="拡大"
              className="hidden text-white hover:bg-white/20 md:inline-flex"
              disabled={view.scale === 5}
              onClick={() => gestures.magnify(1.5)}
            >
              <Plus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="画像を保存"
              className="text-white hover:bg-white/20"
              onClick={onSave}
            >
              <Download />
            </Button>
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
            gestures.attach(element)
            viewport(element)
          }}
          className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
          {...gestures.handlers}
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
                    alt={item.name}
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
        <ViewerCaption {...caption}>
          {count > 1 && (
            <ThumbnailStrip
              images={images}
              index={index}
              position={position}
              onSelect={(target) => carousel?.scrollTo(target)}
            />
          )}
        </ViewerCaption>
      </DialogContent>
    </Dialog>
  )
}

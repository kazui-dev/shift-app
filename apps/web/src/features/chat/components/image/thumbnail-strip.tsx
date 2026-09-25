import { useEffect, useRef } from "react"
import { useMediaQuery } from "@/lib/hooks/use-media-query"
import { thumbnailWidth } from "@/features/chat/components/image/thumbnail"

/** The viewer's thumbnails, following the carousel's position as it swipes. */
export function ThumbnailStrip({
  images,
  index,
  position,
  onSelect,
}: {
  images: { id: string; name: string; thumb: string | undefined }[]
  index: number
  /** The carousel position as a fractional index. */
  position: number
  onSelect: (index: number) => void
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const desktop = useMediaQuery("(min-width: 768px)")
  const strip = useRef<HTMLFieldSetElement>(null)
  useEffect(() => {
    strip.current?.children[index]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reducedMotion ? "instant" : "smooth",
    })
  }, [index, reducedMotion])
  return (
    <div
      data-horizontal-scroll
      className="-mx-5 flex shrink-0 justify-center-safe overflow-x-auto px-5 [scrollbar-width:none]"
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
              aria-label={item.name}
              aria-current={thumb === index}
              onClick={() => onSelect(thumb)}
              // The strip scrolls and clips, so the focus outline is drawn inside.
              className="h-12 shrink-0 overflow-hidden rounded-md bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white md:h-14"
              style={{
                width: desktop ? "3.5rem" : `${thumbnailWidth(focus)}rem`,
                opacity: 0.55 + 0.45 * focus,
              }}
            >
              {item.thumb && (
                <img
                  src={item.thumb}
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
  )
}

import type { UseEmblaCarouselType } from "embla-carousel-react"

type Carousel = NonNullable<UseEmblaCarouselType[1]>

export function pageDrag(event: MouseEvent | TouchEvent): boolean {
  if (!(event instanceof TouchEvent)) return false
  const touch = event.touches.item(0)
  if (!touch || touch.clientX < 24 || touch.clientX > window.innerWidth - 24)
    return false
  if (window.getSelection()?.toString()) return false
  return !(
    event.target instanceof Element &&
    event.target.closest(
      "input,textarea,button:not([data-page-swipe]),select,[contenteditable=true],[role=dialog],[data-horizontal-scroll]"
    )
  )
}

export function boundPages(api: Carousel): () => void {
  const engine = api.internalEngine()
  const translate = engine.translate.to
  // Include settled frames: Embla does not emit scroll on every render.
  engine.translate.to = (value) => {
    for (const position of [
      engine.target,
      engine.location,
      engine.previousLocation,
      engine.offsetLocation,
    ])
      position.set(engine.limit.constrain(position.get()))
    translate(engine.limit.constrain(value))
  }
  return () => {
    engine.translate.to = translate
  }
}

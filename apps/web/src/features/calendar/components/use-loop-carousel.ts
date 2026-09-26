import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import useEmblaCarousel from "embla-carousel-react"

import {
  createLoopCarouselState,
  loopCarouselInitialSlide,
  loopCarouselProgress,
  reduceLoopCarousel,
  type LoopCarouselEvent,
  type LoopCarouselValues,
} from "@/features/calendar/lib/loop-carousel"

export function useLoopCarousel<Value extends string>({
  duration = 25,
  onProgress,
  onSelect,
  value,
  valuesAround,
}: {
  duration?: number
  onProgress?: (value: Value, progress: number) => void
  onSelect: (value: Value, previousValue: Value) => void
  value: Value
  valuesAround: LoopCarouselValues<Value>
}) {
  const [viewportRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: false,
    dragFree: false,
    duration,
    loop: true,
    skipSnaps: false,
    slidesToScroll: 1,
    startIndex: loopCarouselInitialSlide,
  })
  const stateRef = useRef(createLoopCarouselState(value, valuesAround))
  const [values, setValues] = useState(stateRef.current.values)

  const transition = useCallback(
    (event: LoopCarouselEvent<Value>) => {
      const previous = stateRef.current
      const current = reduceLoopCarousel(previous, event, valuesAround)
      stateRef.current = current
      if (current.values !== previous.values) setValues(current.values)
      return { current, previous }
    },
    [valuesAround]
  )

  const paintProgress = useCallback(() => {
    if (!emblaApi || !onProgress) return
    const state = stateRef.current
    onProgress(
      state.value,
      loopCarouselProgress(
        emblaApi.scrollProgress(),
        state.index,
        emblaApi.scrollSnapList()
      )
    )
  }, [emblaApi, onProgress])

  useEffect(() => {
    if (!emblaApi) return undefined

    const pointerDown = () => transition({ type: "pointerDown" })
    const pointerUp = () => transition({ type: "pointerUp" })
    const select = () => {
      const { current, previous } = transition({
        type: "select",
        index: emblaApi.selectedScrollSnap(),
      })
      if (current.value !== previous.value) {
        onSelect(current.value, previous.value)
      }
    }
    const settle = () => {
      const { current } = transition({ type: "settle" })
      onProgress?.(current.value, 0)
    }
    const reInit = () => {
      const { current } = transition({
        type: "reInit",
        index: emblaApi.selectedScrollSnap(),
      })
      onProgress?.(current.value, 0)
    }

    emblaApi.on("scroll", paintProgress)
    emblaApi.on("pointerDown", pointerDown)
    emblaApi.on("pointerUp", pointerUp)
    emblaApi.on("select", select)
    emblaApi.on("settle", settle)
    emblaApi.on("reInit", reInit)
    return () => {
      emblaApi.off("scroll", paintProgress)
      emblaApi.off("pointerDown", pointerDown)
      emblaApi.off("pointerUp", pointerUp)
      emblaApi.off("select", select)
      emblaApi.off("settle", settle)
      emblaApi.off("reInit", reInit)
    }
  }, [emblaApi, onProgress, onSelect, paintProgress, transition])

  useLayoutEffect(() => {
    const state = stateRef.current
    if (value === state.value) {
      if (state.phase === "idle") onProgress?.(state.value, 0)
      else paintProgress()
      return
    }

    const index = emblaApi?.selectedScrollSnap() ?? state.index
    const { current } = transition({ type: "replace", index, value })
    onProgress?.(current.value, 0)
    emblaApi?.scrollTo(index, true)
  }, [emblaApi, onProgress, paintProgress, transition, value])

  return {
    scrollNext: () => emblaApi?.scrollNext(),
    scrollPrevious: () => emblaApi?.scrollPrev(),
    values,
    viewportRef,
  }
}

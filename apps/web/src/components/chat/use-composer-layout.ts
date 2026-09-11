import { useLayoutEffect, useRef, useState } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"

// Measure the destination layout without resizing the editable text for measurement.
export function useComposerLayout(
  content: string,
  focused: boolean,
  ready: boolean
) {
  const input = useRef<HTMLTextAreaElement>(null)
  const measure = useRef<HTMLTextAreaElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const previous = useRef(false)
  const initialized = useRef(false)
  const animation = useRef<Animation | null>(null)
  const [expanded, setExpanded] = useState(false)
  const mobile = useMediaQuery("(max-width: 767px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  useLayoutEffect(() => {
    const field = input.current,
      sizer = measure.current,
      container = body.current
    if (!field || !sizer || !container || !ready) return undefined
    const layout = () => {
      if (!initialized.current) container.style.transition = "none"
      sizer.style.paddingInline = "40px"
      const next = composerExpanded({
        mobile,
        focused,
        content,
        previous: previous.current,
        overflowing: sizer.scrollHeight > 32,
      })
      sizer.style.paddingInline = next ? "4px" : "40px"
      const height = Math.max(32, Math.min(sizer.scrollHeight, 168))
      field.style.paddingInline = next ? "4px" : "40px"
      field.style.height = `${height}px`
      container.style.height = `${height + (next ? 52 : 16)}px`
      if (previous.current !== next) {
        const transform = getComputedStyle(field).transform
        const offset =
          transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41
        animation.current?.cancel()
        if (initialized.current && !reducedMotion)
          animation.current = field.animate(
            [
              { transform: `translateX(${offset + (next ? 36 : -36)}px)` },
              { transform: "translateX(0)" },
            ],
            { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" }
          )
      }
      if (!initialized.current) {
        void container.offsetHeight
        container.style.removeProperty("transition")
        initialized.current = true
      }
      previous.current = next
      setExpanded(next)
    }
    layout()
    let width = container.clientWidth
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === width) return
      width = container.clientWidth
      layout()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [content, focused, mobile, reducedMotion, ready])
  useLayoutEffect(() => () => animation.current?.cancel(), [])
  return { input, measure, body, expanded }
}

export function composerExpanded({
  mobile,
  focused,
  content,
  previous,
  overflowing,
}: {
  mobile: boolean
  focused: boolean
  content: string
  previous: boolean
  overflowing: boolean
}) {
  return (mobile && focused) || (!!content && (previous || overflowing))
}

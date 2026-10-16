import { useLayoutEffect, useRef, type ReactNode } from "react"
import "./time-grid.css"

export function ShiftTimeDialog({
  children,
  titleId,
  onClose,
}: {
  children: ReactNode
  titleId: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return undefined
    const anchor =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element.showModal()
    const place = () => {
      const rect = anchor?.getBoundingClientRect()
      const width = element.offsetWidth,
        height = element.offsetHeight
      const center = window.innerWidth <= 640 || !rect
      element.style.left = `${center ? (window.innerWidth - width) / 2 : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`
      element.style.top = `${Math.max(16, center ? (window.innerHeight - height) / 2 : rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(element)
    window.addEventListener("resize", place)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
      element.close()
      requestAnimationFrame(() => {
        if (!element.open && anchor?.isConnected)
          anchor.focus({ preventScroll: true })
      })
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="shift-time-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {children}
    </dialog>
  )
}

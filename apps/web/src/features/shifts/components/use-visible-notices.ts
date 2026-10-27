import { useEffect, useState } from "react"
import type { ShiftNotice } from "@workspace/shared/shifts"

const emptyNotices: ShiftNotice[] = []

export function useVisibleNotices(items: ShiftNotice[] = emptyNotices) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const next = Math.min(
        ...items
          .flatMap((item) => [
            Date.parse(item.startsAt),
            Date.parse(item.endsAt),
          ])
          .filter((boundary) => boundary > time)
      )
      // Recheck the clock regularly as well as at each display boundary.
      timer = setTimeout(update, Math.min(next - time, 60_000))
    }
    update()
    document.addEventListener("visibilitychange", update)
    window.addEventListener("focus", update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", update)
      window.removeEventListener("focus", update)
    }
  }, [items])
  return items.filter(
    (item) => Date.parse(item.startsAt) <= now && now < Date.parse(item.endsAt)
  )
}

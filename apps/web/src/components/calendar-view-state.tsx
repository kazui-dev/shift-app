import { useMemo, useRef, useState, type ReactNode } from "react"

import { japanDateTime } from "@/lib/japan-time"
import { CalendarViewStateContext } from "./calendar-view-context"

function currentDate(): string {
  return japanDateTime(new Date()).date
}

export function CalendarViewStateProvider({
  children,
}: {
  children: ReactNode
}) {
  const [date, setDate] = useState(currentDate)
  const preferredDayRef = useRef(Number(date.slice(8)))
  const scrollTopRef = useRef<number | null>(null)
  const value = useMemo(
    () => ({ date, setDate, preferredDayRef, scrollTopRef }),
    [date, setDate]
  )

  return (
    <CalendarViewStateContext value={value}>
      {children}
    </CalendarViewStateContext>
  )
}

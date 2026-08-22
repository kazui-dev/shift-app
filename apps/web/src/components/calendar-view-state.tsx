import { useMemo, useRef, useState, type ReactNode } from "react"

import { CalendarViewStateContext } from "./calendar-view-context"

function currentDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function CalendarViewStateProvider({
  children,
}: {
  children: ReactNode
}) {
  const [date, setDate] = useState(currentDate)
  const preferredDayRef = useRef(new Date().getDate())
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

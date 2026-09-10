import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"

import { localDate, moveMonth } from "@/lib/calendar-dates"
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
  const selectDate = useCallback((nextDate: string) => {
    preferredDayRef.current = localDate(nextDate).getDate()
    setDate(nextDate)
  }, [])
  const selectMonth = useCallback((months: number) => {
    setDate((current) => moveMonth(current, months, preferredDayRef.current))
  }, [])
  const readScrollTop = useCallback(() => scrollTopRef.current, [])
  const saveScrollTop = useCallback((scrollTop: number) => {
    scrollTopRef.current = scrollTop
  }, [])
  const value = useMemo(
    () => ({ date, selectDate, selectMonth, readScrollTop, saveScrollTop }),
    [date, readScrollTop, saveScrollTop, selectDate, selectMonth]
  )

  return (
    <CalendarViewStateContext value={value}>
      {children}
    </CalendarViewStateContext>
  )
}

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "@tanstack/react-router"
import { moveMonth } from "@/lib/calendar-dates"
import { resolveCalendarView, saveCalendarView } from "@/lib/calendar-view"
import { CalendarViewStateContext } from "./calendar-view-context"

export function CalendarViewStateProvider({
  children,
  storageKey,
  explicitDate,
}: {
  children: ReactNode
  storageKey: string
  explicitDate: string | undefined
}) {
  const navigate = useNavigate({ from: "/calendar" })
  const [initial] = useState(() =>
    resolveCalendarView(storageKey, explicitDate)
  )
  const [date, setDate] = useState(initial.date)
  const preferredDay = useRef(initial.preferredDay)
  const scrollTop = useRef(initial.scrollTop)
  const currentDate = useRef(date)
  const persist = useCallback(
    () =>
      saveCalendarView(storageKey, {
        date: currentDate.current,
        scrollTop: scrollTop.current,
        preferredDay: preferredDay.current,
      }),
    [storageKey]
  )
  const change = useCallback(
    (next: string) => {
      currentDate.current = next
      setDate(next)
      persist()
      void navigate({
        search: (previous) => ({ ...previous, date: next }),
        replace: true,
        resetScroll: false,
      })
    },
    [navigate, persist]
  )
  // External links and browser history are applied before the next paint.
  useLayoutEffect(() => {
    const restored = resolveCalendarView(storageKey, explicitDate)
    if (restored.date !== currentDate.current) {
      currentDate.current = restored.date
      preferredDay.current = restored.preferredDay
      setDate(restored.date)
    }
    persist()
  }, [explicitDate, storageKey, persist])
  const selectDate = useCallback(
    (next: string) => {
      preferredDay.current = Number(next.slice(8))
      change(next)
    },
    [change]
  )
  const selectMonth = useCallback(
    (months: number) => {
      change(moveMonth(currentDate.current, months, preferredDay.current))
    },
    [change]
  )
  const readScrollTop = useCallback(() => scrollTop.current, [])
  const saveScrollTop = useCallback(
    (value: number) => {
      scrollTop.current = value
      persist()
    },
    [persist]
  )
  const value = useMemo(
    () => ({ date, selectDate, selectMonth, readScrollTop, saveScrollTop }),
    [date, selectDate, selectMonth, readScrollTop, saveScrollTop]
  )
  return (
    <CalendarViewStateContext value={value}>
      {children}
    </CalendarViewStateContext>
  )
}

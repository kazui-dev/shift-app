import { useOfflineMode } from "@/components/offline-mode-context"
import { useDisplayYear } from "@/components/use-display-year"
import { useEffect, useMemo } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"

import {
  assignmentMonthQuery,
  assignmentsByDate,
  type CalendarAssignment,
} from "@/api/assignments"
import {
  monthValue,
  monthValuesForDates,
  moveMonthValue,
} from "@/lib/calendar-dates"

export type CalendarAssignments = {
  byDate: Map<string, CalendarAssignment[]>
}

export function useCalendarAssignments(
  selectedDate: string,
  dates: string[]
): CalendarAssignments {
  const { year } = useDisplayYear()
  const offline = useOfflineMode()
  const queryClient = useQueryClient()
  const months = useMemo(() => monthValuesForDates(dates), [dates])
  const queries = useQueries({
    queries: months.map((month) => assignmentMonthQuery(month, year, !offline)),
  })
  const selectedMonth = monthValue(selectedDate)
  const selectedMonthIndex = months.indexOf(selectedMonth)
  const selectedMonthQuery = queries[selectedMonthIndex]
  const byDate = useMemo(
    () =>
      assignmentsByDate(
        dates,
        queries.map((query) => query.data)
      ),
    [dates, queries]
  )

  useEffect(() => {
    if (!selectedMonthQuery?.isSuccess) return
    for (const distance of [-1, 1]) {
      void queryClient.prefetchQuery(
        assignmentMonthQuery(moveMonthValue(selectedMonth, distance), year)
      )
    }
  }, [queryClient, selectedMonth, selectedMonthQuery?.isSuccess, year])

  return {
    byDate,
  }
}

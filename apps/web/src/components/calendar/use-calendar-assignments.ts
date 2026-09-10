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
  selectedMonthDataUpdatedAt: number
  selectedMonthError: unknown
  selectedMonthIsError: boolean
  refetchSelectedMonth: () => void
}

export function useCalendarAssignments(
  selectedDate: string,
  dates: string[]
): CalendarAssignments {
  const queryClient = useQueryClient()
  const months = useMemo(() => monthValuesForDates(dates), [dates])
  const queries = useQueries({
    queries: months.map(assignmentMonthQuery),
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
        assignmentMonthQuery(moveMonthValue(selectedMonth, distance))
      )
    }
  }, [queryClient, selectedMonth, selectedMonthQuery?.isSuccess])

  return {
    byDate,
    selectedMonthDataUpdatedAt: selectedMonthQuery?.dataUpdatedAt ?? 0,
    selectedMonthError: selectedMonthQuery?.error,
    selectedMonthIsError: selectedMonthQuery?.isError ?? false,
    refetchSelectedMonth: () => {
      void selectedMonthQuery?.refetch()
    },
  }
}

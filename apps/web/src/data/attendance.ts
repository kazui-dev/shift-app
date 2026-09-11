import { queryOptions } from "@tanstack/react-query"
import { getShiftAttendance } from "@/api/assignments"
export const attendanceQuery = (id: string) =>
  queryOptions({
    queryKey: ["shift-attendance", id],
    queryFn: () => getShiftAttendance(id),
    staleTime: 15_000,
  })

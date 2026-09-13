import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/data/keys"
import { getShiftAttendance } from "@/api/assignments"
export const attendanceQuery = (id: string) =>
  queryOptions({
    queryKey: keys.shiftAttendance(id),
    queryFn: () => getShiftAttendance(id),
    staleTime: 15_000,
  })

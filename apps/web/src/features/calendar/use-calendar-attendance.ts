import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/lib/toast"
import { keys } from "@/app/data/keys"
import { submitAttendance } from "@/features/shifts/api/assignments"
import { errorMessage } from "@/lib/http/client"
import {
  checkCampusLocation,
  type CampusLocation,
} from "./components/campus-location"

type LocationIssue = {
  assignmentId: string
  reason: Exclude<CampusLocation, "confirmed">
}

export function useCalendarAttendance() {
  const queryClient = useQueryClient()
  // Keep the sheet mounted while its closing animation finishes.
  const [attendance, setAttendance] = useState<{
    id: string
    open: boolean
  } | null>(null)
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null)

  const saveCheckIn = useCallback(
    async (assignmentId: string, locationConfirmed: boolean) => {
      setCheckingInId(assignmentId)
      try {
        await submitAttendance(assignmentId, {
          state: "present",
          locationConfirmed,
        })
        await queryClient.invalidateQueries({
          queryKey: keys.assignmentMonth(),
        })
        toast.success("出勤を記録しました。")
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setCheckingInId(null)
      }
    },
    [queryClient]
  )

  // A failed campus check needs an explicit decision before recording attendance.
  const checkIn = useCallback(
    async (assignmentId: string) => {
      setCheckingInId(assignmentId)
      const location = await checkCampusLocation()
      if (location === "confirmed") {
        await saveCheckIn(assignmentId, true)
        return
      }
      setCheckingInId(null)
      setLocationIssue({ assignmentId, reason: location })
    },
    [saveCheckIn]
  )

  return {
    attendance,
    checkingInId,
    locationIssue,
    openAttendance: (id: string) => setAttendance({ id, open: true }),
    closeAttendance: () =>
      setAttendance((current) => current && { ...current, open: false }),
    clearAttendance: () => setAttendance(null),
    clearLocationIssue: () => setLocationIssue(null),
    checkIn,
    saveCheckIn,
  }
}

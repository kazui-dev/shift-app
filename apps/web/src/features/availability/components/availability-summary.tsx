import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/lib/toast"
import { errorMessage } from "@/lib/http/client"
import { refreshAvailability } from "../data/availability"
import { AvailabilitySchedule } from "./availability-schedule"
import { AvailabilityProgress } from "./availability-progress"

export function AvailabilitySummary({ year }: { year: number }) {
  const client = useQueryClient()
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<unknown>, onSuccess?: () => void) {
    if (pending) return
    setPending(true)
    try {
      await action()
      await refreshAvailability(client, year)
      onSuccess?.()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-12">
      <AvailabilitySchedule year={year} pending={pending} run={run} />
      <AvailabilityProgress year={year} pending={pending} run={run} />
    </div>
  )
}

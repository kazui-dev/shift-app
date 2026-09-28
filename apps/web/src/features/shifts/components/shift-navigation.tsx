import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  activitiesQuery,
  activityQuery,
} from "@/features/shifts/data/activities"
import { errorMessage } from "@/lib/http/client"
import { toast } from "@workspace/ui/lib/toast"
import { japanDateTime, japanDateWeekday } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { SelectField } from "@/components/select-field"
import type { EditorData } from "../editor-data"

export function ShiftNavigation({
  activity,
  disabled,
  onPendingChange,
}: {
  activity: EditorData["activity"]
  disabled: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [loading, setLoading] = useState(false)
  const all = useQuery(activitiesQuery(activity.year)).data?.activities ?? []
  const dates = [
    ...new Set(all.map((item) => japanDateTime(item.startsAt).date)),
  ].sort()
  const date = japanDateTime(activity.startsAt).date
  const index = dates.indexOf(date)
  async function open(id: string) {
    if (disabled || loading || id === activity.id) return
    setLoading(true)
    onPendingChange(true)
    try {
      await client.ensureQueryData(activityQuery(id))
      await navigate({
        to: "/manage/shifts/$shiftId",
        params: { shiftId: id },
        replace: true,
      })
    } catch (error) {
      toast.error(errorMessage(error), {
        action: { label: "再試行", onClick: () => void open(id) },
      })
    } finally {
      setLoading(false)
      onPendingChange(false)
    }
  }
  function move(next: string | undefined) {
    const candidates = all.filter(
      (item) => japanDateTime(item.startsAt).date === next
    )
    const target =
      candidates.find((item) => item.name === activity.name) ?? candidates[0]
    if (target) void open(target.id)
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="前の日"
        disabled={disabled || loading || index <= 0}
        onClick={() => move(dates[index - 1])}
      >
        <ChevronLeft />
      </Button>
      <SelectField
        aria-label="シフトの日付"
        value={date}
        disabled={disabled || loading}
        className="w-auto"
        options={dates.map((value) => ({
          value,
          label: japanDateWeekday(`${value}T12:00:00+09:00`),
        }))}
        onValueChange={move}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="次の日"
        disabled={disabled || loading || index >= dates.length - 1}
        onClick={() => move(dates[index + 1])}
      >
        <ChevronRight />
      </Button>
      <SelectField
        aria-label="編集するシフト"
        value={activity.id}
        disabled={disabled || loading}
        className="w-auto min-w-28"
        options={all
          .filter((item) => japanDateTime(item.startsAt).date === date)
          .map((item) => ({ value: item.id, label: item.name }))}
        onValueChange={(id) => void open(id)}
      />
      {loading && (
        <output className="text-xs text-muted-foreground">読み込み中…</output>
      )}
    </div>
  )
}

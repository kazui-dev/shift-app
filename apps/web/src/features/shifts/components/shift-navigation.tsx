import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { activitiesQuery } from "@/features/activities/data/activities"
import { japanDateTime, japanDateWeekday } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { SelectField } from "@/components/select-field"
import type { EditorData } from "./time-grid"

export function ShiftNavigation({
  activity,
  disabled,
}: {
  activity: EditorData["activity"]
  disabled: boolean
}) {
  const navigate = useNavigate()
  const all = useQuery(activitiesQuery(activity.year)).data?.activities ?? []
  const dates = [
    ...new Set(all.map((item) => japanDateTime(item.startsAt).date)),
  ].sort()
  const date = japanDateTime(activity.startsAt).date
  const index = dates.indexOf(date)
  function open(id: string) {
    void navigate({
      to: "/manage/shifts/$shiftId",
      params: { shiftId: id },
      replace: true,
      state: (previous) =>
        previous.managementParent
          ? { managementParent: previous.managementParent }
          : {},
    })
  }
  function move(next: string | undefined) {
    const candidates = all.filter(
      (item) => japanDateTime(item.startsAt).date === next
    )
    const target =
      candidates.find((item) => item.name === activity.name) ?? candidates[0]
    if (target) open(target.id)
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="前の日"
        disabled={disabled || index <= 0}
        onClick={() => move(dates[index - 1])}
      >
        <ChevronLeft />
      </Button>
      <SelectField
        aria-label="シフトの日付"
        value={date}
        disabled={disabled}
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
        disabled={disabled || index >= dates.length - 1}
        onClick={() => move(dates[index + 1])}
      >
        <ChevronRight />
      </Button>
      <SelectField
        aria-label="編集するシフト"
        value={activity.id}
        disabled={disabled}
        className="w-auto min-w-28"
        options={all
          .filter((item) => japanDateTime(item.startsAt).date === date)
          .map((item) => ({ value: item.id, label: item.name }))}
        onValueChange={open}
      />
    </div>
  )
}

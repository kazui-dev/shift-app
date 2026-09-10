import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { localDate } from "@/lib/calendar-dates"

function monthLabel(date: string): string {
  return `${localDate(date).getMonth() + 1}月`
}

export function MonthSwitcher({
  date,
  onDateChange,
  onMonthChange,
}: {
  date: string
  onDateChange: (date: string) => void
  onMonthChange: (months: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="前の月"
        onClick={() => onMonthChange(-1)}
      >
        <ChevronLeft />
      </Button>
      <label className="relative grid min-h-10 w-16 cursor-pointer place-items-center px-2 text-center font-semibold">
        <span aria-hidden>{monthLabel(date)}</span>
        <input
          aria-label="日付を選択"
          className="absolute inset-0 size-full cursor-pointer opacity-0 outline-none"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="次の月"
        onClick={() => onMonthChange(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

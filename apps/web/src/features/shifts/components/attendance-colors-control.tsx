import { useId } from "react"
import { Switch } from "@workspace/ui/components/switch"

export function AttendanceColorsControl({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: () => void
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className="flex min-h-8 items-center gap-2 text-xs font-medium sm:text-sm"
      title="遅刻：黄、欠勤：赤、出勤：緑、未記録：グレー"
    >
      勤怠状況
      <Switch
        id={id}
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </label>
  )
}

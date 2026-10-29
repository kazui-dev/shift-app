import {
  japanInputValue,
  japanLocalDateTime,
} from "@workspace/shared/japan-time"
import { useState } from "react"
import { Settings2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ResponsiveDialog } from "@/components/responsive-overlay"

export function ShiftActionsDialog({
  startsAt,
  endsAt,
  dirty,
  pending,
  active,
  onClose,
  onSettings,
  onAttendance,
  onNotify,
  onCopy,
  onDelete,
}: {
  startsAt: string
  endsAt: string
  dirty: boolean
  pending: boolean
  active: boolean
  onClose: () => void
  onSettings: () => void
  onAttendance: () => void
  onNotify: () => void
  onCopy: (date: string, startsAt: string, endsAt: string) => void
  onDelete: () => void
}) {
  const [date, setDate] = useState("")
  const [start, setStart] = useState(japanInputValue(startsAt).slice(11))
  const [end, setEnd] = useState(japanInputValue(endsAt).slice(11))
  return (
    <ResponsiveDialog
      open
      title="シフトの操作"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onSettings}>
            <Settings2 />
            シフトの設定
          </Button>
          <Button size="sm" variant="outline" onClick={onAttendance}>
            勤怠・連絡
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || dirty || !active}
          onClick={onNotify}
        >
          更新を通知する
        </Button>
        {dirty && (
          <p className="text-xs text-muted-foreground">
            通知・複製の前に変更を保存してください。
          </p>
        )}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const from = japanLocalDateTime(`${date}T${start}`)
            let to = japanLocalDateTime(`${date}T${end}`)
            if (to <= from) to += 86_400_000
            if (Number.isFinite(from) && Number.isFinite(to))
              onCopy(
                date,
                new Date(from).toISOString(),
                new Date(to).toISOString()
              )
          }}
        >
          <Input
            type="date"
            aria-label="複製先の日付"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input
            type="time"
            aria-label="複製先の開始"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            type="time"
            aria-label="複製先の終了"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={pending || dirty || !date || !start || !end}
          >
            複製
          </Button>
        </form>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={pending || dirty}
          onClick={onDelete}
        >
          シフトを削除
        </Button>
      </div>
    </ResponsiveDialog>
  )
}

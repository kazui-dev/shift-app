import { useState } from "react"
import { Settings2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ResponsiveDialog } from "@/components/responsive-overlay"

export function ShiftActionsDialog({
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
  dirty: boolean
  pending: boolean
  active: boolean
  onClose: () => void
  onSettings: () => void
  onAttendance: () => void
  onNotify: () => void
  onCopy: (date: string) => void
  onDelete: () => void
}) {
  const [date, setDate] = useState("")
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
          <Button variant="outline" onClick={onSettings}>
            <Settings2 />
            シフトの設定
          </Button>
          <Button variant="outline" onClick={onAttendance}>
            出勤・連絡
          </Button>
        </div>
        <Button
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
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            onCopy(date)
          }}
        >
          <Input
            type="date"
            aria-label="複製先の日付"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Button disabled={pending || dirty || !date}>複製</Button>
        </form>
        <Button
          variant="ghost"
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

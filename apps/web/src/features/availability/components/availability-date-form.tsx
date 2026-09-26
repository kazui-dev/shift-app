import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"
import type { FormDate } from "@workspace/shared/availability"
import { refreshAvailability } from "../data/availability"
import { MinuteInput } from "@/components/minute-input"
import { saveAvailabilityDate } from "@/features/availability/api/availability"
import { errorMessage } from "@/lib/http/client"

/** The inline editor an availability date row expands into. */
export function AvailabilityDateForm({
  year,
  initial,
  onSaved,
  onCancel,
}: {
  year: number
  initial?: FormDate
  onSaved: () => void
  onCancel: () => void
}) {
  const client = useQueryClient()
  const fieldId = `availability-${initial?.date ?? "new"}`
  const [date, setDate] = useState(initial?.date ?? "")
  const [startsMinute, setStart] = useState(initial?.startsMinute ?? 540)
  const [endsMinute, setEnd] = useState(initial?.endsMinute ?? 1080)
  const [accepting, setAccepting] = useState(initial?.accepting ?? false)
  const [pending, setPending] = useState(false)
  const invalid = !date || startsMinute >= endsMinute
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (pending || invalid) return
    setPending(true)
    try {
      await saveAvailabilityDate(year, {
        date,
        startsMinute,
        endsMinute,
        accepting,
      })
      await refreshAvailability(client, year)
      onSaved()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={(event) => void save(event)}>
      <fieldset disabled={pending} className="space-y-6">
        {!initial && (
          <div className="space-y-2.5">
            <label htmlFor={fieldId} className="text-sm font-medium">
              日付
            </label>
            <Input
              id={fieldId}
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <p className="text-sm font-medium">開始時刻</p>
            <MinuteInput
              label="開始時刻"
              value={startsMinute}
              onChange={setStart}
            />
          </div>
          <div className="space-y-2.5">
            <p className="text-sm font-medium">終了時刻</p>
            <MinuteInput
              label="終了時刻"
              value={endsMinute}
              onChange={setEnd}
            />
          </div>
        </div>
        {startsMinute >= endsMinute && (
          <p role="alert" className="text-sm text-destructive">
            終了時刻は開始時刻より後にしてください
          </p>
        )}
        <label
          htmlFor={`${fieldId}-accepting`}
          className="flex items-center justify-between gap-4 border-t py-4 text-sm font-medium"
        >
          希望を受け付ける
          <Switch
            id={`${fieldId}-accepting`}
            checked={accepting}
            onCheckedChange={setAccepting}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="submit" size="sm" disabled={invalid}>
            保存
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

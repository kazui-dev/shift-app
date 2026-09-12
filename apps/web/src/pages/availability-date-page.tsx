import { useState } from "react"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { FormDate } from "@workspace/shared/availability"
import {
  ResponsivePage,
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"
import { MinuteInput } from "@/components/minute-input"
import { useManagementYear } from "@/components/use-management-year"
import { usePageClose } from "@/components/use-page-close"
import { availabilityDatesQuery } from "@/data/availability"
import { saveAvailabilityDate } from "@/api/availability"
import { errorMessage } from "@/api/client"

export function AvailabilityDatePage({ date }: { date?: string }) {
  const { year } = useManagementYear()
  const navigate = useNavigate()
  const page = usePageClose(
    () => void navigate({ to: "/manage/availability", replace: true })
  )
  const query = useQuery({
    ...availabilityDatesQuery(year ?? 0),
    enabled: year !== null,
  })
  const initial = query.data?.dates.find((item) => item.date === date)
  return (
    <div className="fixed inset-0 z-50 md:contents">
      <ResponsivePage
        open={page.open}
        onClose={page.close}
        onClosed={page.onClosed}
      >
        {year !== null && (!date || initial) ? (
          <DateEditor
            key={`${year}:${date ?? "new"}`}
            year={year}
            initial={initial}
            onClose={page.close}
          />
        ) : (
          <>
            <ResponsivePageHeader title="日程を編集" onBack={page.close} />
            <ResponsivePageBody>
              <p className="text-sm text-muted-foreground">
                {query.isPending ? "読み込み中…" : "日程を取得できませんでした"}
              </p>
            </ResponsivePageBody>
          </>
        )}
      </ResponsivePage>
    </div>
  )
}
function DateEditor({
  year,
  initial,
  onClose,
}: {
  year: number
  initial: FormDate | undefined
  onClose: () => void
}) {
  const client = useQueryClient()
  const [date, setDate] = useState(initial?.date ?? "")
  const [startsMinute, setStart] = useState(initial?.startsMinute ?? 540)
  const [endsMinute, setEnd] = useState(initial?.endsMinute ?? 1080)
  const [accepting, setAccepting] = useState(initial?.accepting ?? false)
  const [pending, setPending] = useState(false)
  async function save() {
    if (pending || !date || startsMinute >= endsMinute) return
    setPending(true)
    try {
      await saveAvailabilityDate(year, {
        date,
        startsMinute,
        endsMinute,
        accepting,
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ["availability-dates", year] }),
        client.invalidateQueries({ queryKey: ["availability", year] }),
        client.invalidateQueries({
          queryKey: ["availability-submissions", year],
        }),
      ])
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <ResponsivePageHeader
        title={initial ? "日程を編集" : "日程を追加"}
        onBack={onClose}
        backDisabled={pending}
        action={
          <Button
            type="submit"
            size="sm"
            disabled={pending || !date || startsMinute >= endsMinute}
          >
            保存
          </Button>
        }
      />
      <ResponsivePageBody>
        <fieldset disabled={pending} className="space-y-6">
          <div className="space-y-2.5">
            <label htmlFor="availability-date" className="text-sm font-medium">
              日付
            </label>
            <Input
              id="availability-date"
              type="date"
              required
              disabled={!!initial}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
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
            htmlFor="availability-accepting"
            className="flex items-center justify-between gap-4 border-y py-4 text-sm font-medium"
          >
            希望を受け付ける
            <Switch
              id="availability-accepting"
              checked={accepting}
              onCheckedChange={setAccepting}
            />
          </label>
        </fieldset>
      </ResponsivePageBody>
    </form>
  )
}

export function EditAvailabilityDatePage() {
  const { date } = getRouteApi("/_app/manage/availability/$date").useParams()
  return <AvailabilityDatePage key={date} date={date} />
}

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell, Plus, Trash2 } from "lucide-react"
import { japanFullDate } from "@workspace/shared/japan-time"
import type { FormDate } from "@workspace/shared/availability"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { toast } from "@workspace/ui/lib/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  notifyAvailability,
  saveAvailabilityDate,
  deleteAvailabilityDate,
} from "../api/availability"
import { availabilityDatesQuery } from "../data/availability"
import { AvailabilityDateForm } from "./availability-date-form"

const newDate = "new"

function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
}

export function AvailabilitySchedule({
  year,
  pending,
  run,
}: {
  year: number
  pending: boolean
  run: (action: () => Promise<unknown>, onSuccess?: () => void) => Promise<void>
}) {
  const dates = useQuery(availabilityDatesQuery(year))
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [removing, setRemoving] = useState<FormDate | null>(null)
  const adding = expanded.includes(newDate)
  const clearSelection = () => {
    setSelected([])
    setRemoving(null)
  }
  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">受付日程</h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={
                pending || !dates.data?.dates.some((date) => date.accepting)
              }
              onClick={() =>
                void run(async () => {
                  await notifyAvailability(year, "all")
                  toast.success("受付を通知しました。")
                }, clearSelection)
              }
            >
              <Bell />
              受付を通知
            </Button>
            <Button
              size="sm"
              disabled={adding}
              onClick={() => setExpanded([newDate])}
            >
              <Plus />
              日程を追加
            </Button>
          </div>
        </div>
        {dates.isError ? (
          <Button variant="outline" onClick={() => void dates.refetch()}>
            日程を再読み込み
          </Button>
        ) : (
          <Accordion
            className="border-y"
            value={expanded}
            onValueChange={(value) => setExpanded(value.map(String))}
          >
            {adding && (
              <AccordionItem value={newDate}>
                <AccordionTrigger className="px-1">新しい日程</AccordionTrigger>
                <AccordionContent className="px-1">
                  <AvailabilityDateForm
                    year={year}
                    onSaved={() => setExpanded([])}
                    onCancel={() => setExpanded([])}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
            {dates.data?.dates.map((date) => (
              <AccordionItem key={date.date} value={date.date}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    aria-label={`${date.date}を選択`}
                    disabled={pending}
                    checked={selected.includes(date.date)}
                    onCheckedChange={(checked) =>
                      setSelected((values) =>
                        checked
                          ? [...values, date.date]
                          : values.filter((value) => value !== date.date)
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <AccordionTrigger className="w-full items-center gap-3 px-1 hover:no-underline">
                      <span className="block min-w-0 flex-1 space-y-1">
                        <span className="block text-sm font-medium">
                          {japanFullDate(date.date)}
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                          {clock(date.startsMinute)}〜{clock(date.endsMinute)}{" "}
                          <span className="ml-2">
                            {date.accepting ? "受付中" : "受付終了"}
                          </span>
                        </span>
                      </span>
                    </AccordionTrigger>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${date.date}を削除`}
                    disabled={pending}
                    onClick={() => setRemoving(date)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <AccordionContent className="px-1">
                  <AvailabilityDateForm
                    year={year}
                    initial={date}
                    onSaved={() => setExpanded([])}
                    onCancel={() => setExpanded([])}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
            {dates.data?.dates.length === 0 && !adding && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                日程がありません
              </p>
            )}
            {dates.isPending && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                読み込み中…
              </p>
            )}
          </Accordion>
        )}
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            {selected.length ? `${selected.length}日選択中` : ""}
          </span>
          {[true, false].map((accepting) => (
            <Button
              key={String(accepting)}
              size="sm"
              variant="outline"
              disabled={pending || selected.length === 0}
              onClick={() =>
                void run(
                  () =>
                    Promise.all(
                      (dates.data?.dates ?? [])
                        .filter((date) => selected.includes(date.date))
                        .map((date) =>
                          saveAvailabilityDate(year, {
                            date: date.date,
                            startsMinute: date.startsMinute,
                            endsMinute: date.endsMinute,
                            accepting,
                          })
                        )
                    ),
                  clearSelection
                )
              }
            >
              {accepting ? "受付を開始" : "受付を終了"}
            </Button>
          ))}
        </div>
      </section>
      {removing && (
        <ConfirmDialog
          title="日程を削除しますか"
          confirmLabel="削除"
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            void run(
              () => deleteAvailabilityDate(year, removing.date),
              clearSelection
            )
          }
        />
      )}
    </>
  )
}

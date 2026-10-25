import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Button } from "@workspace/ui/components/button"
import { Fragment } from "react"
import {
  japanInputValue,
  japanLocalDateTime,
} from "@workspace/shared/japan-time"
import type { ShiftNotice } from "@workspace/shared/shifts"

export function NoticeSettings({
  items,
  onChange,
  activity,
}: {
  items: ShiftNotice[]
  onChange: (items: ShiftNotice[]) => void
  activity: { startsAt: string; endsAt: string }
}) {
  function update(id: string, patch: Partial<ShiftNotice>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }
  return (
    <fieldset className="space-y-4 rounded-md border p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-medium">
        <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span>重要な連絡事項</span>
          <span className="text-xs font-normal text-muted-foreground">
            カレンダーに表示されます。
          </span>
        </span>
      </legend>
      {items.map((item, index) => (
        <div key={item.id} className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">連絡事項 {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange(items.filter((notice) => notice.id !== item.id))
              }
            >
              削除
            </Button>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-xs">表示期間</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              {(["startsAt", "endsAt"] as const).map((field) => (
                <Fragment key={field}>
                  {field === "endsAt" && <span aria-hidden="true">〜</span>}
                  <Input
                    aria-label={
                      field === "startsAt" ? "表示期間の開始" : "表示期間の終了"
                    }
                    type="datetime-local"
                    className="min-w-0"
                    required
                    value={japanInputValue(item[field])}
                    onChange={(event) => {
                      const time = japanLocalDateTime(event.target.value)
                      if (Number.isFinite(time))
                        update(item.id, {
                          [field]: new Date(time).toISOString(),
                        })
                    }}
                  />
                </Fragment>
              ))}
            </div>
          </fieldset>
          <label
            htmlFor={`notice-content-${item.id}`}
            className="block space-y-2 text-sm"
          >
            連絡内容
            <Textarea
              id={`notice-content-${item.id}`}
              rows={3}
              required
              maxLength={2000}
              value={item.content}
              onChange={(event) =>
                update(item.id, { content: event.target.value })
              }
            />
          </label>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          onChange([
            ...items,
            {
              id: crypto.randomUUID(),
              startsAt: activity.startsAt,
              endsAt: activity.endsAt,
              content: "",
            },
          ])
        }}
      >
        連絡事項を追加
      </Button>
    </fieldset>
  )
}

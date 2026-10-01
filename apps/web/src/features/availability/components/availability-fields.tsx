import type { DayAnswer, FormDate } from "@workspace/shared/availability"
import { japanDateStart, japanDateWeekday } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Plus, Trash2 } from "lucide-react"
import { MinuteInput } from "@/components/minute-input"
import { answerStatus } from "./answer-status"
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
export function AvailabilityFields({
  dates,
  answers,
  submitted,
  pending,
  allowClosed = false,
  onUpdate,
}: {
  dates: FormDate[]
  answers: DayAnswer[]
  submitted: DayAnswer[]
  pending: boolean
  allowClosed?: boolean
  onUpdate: (
    date: FormDate,
    choice: DayAnswer["choice"],
    times?: DayAnswer["times"]
  ) => void
}) {
  return (
    <>
      {!dates.length && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          日程はまだ設定されていません。
        </p>
      )}
      <div className="divide-y">
        {dates.map((date) => {
          const answer = answers.find((value) => value.date === date.date)
          const status = answerStatus(
            date,
            answer,
            submitted.find((value) => value.date === date.date)
          )
          return (
            <fieldset
              key={date.date}
              disabled={(!date.accepting && !allowClosed) || pending}
              className="min-w-0 py-5 first:pt-0"
            >
              <legend className="sr-only">{date.date}</legend>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    {japanDateWeekday(japanDateStart(date.date))}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {time(date.startsMinute)}〜{time(date.endsMinute)}
                  </p>
                </div>
                {!allowClosed &&
                  (status === "受付終了" || status === "再回答が必要") && (
                    <span className="text-xs text-muted-foreground">
                      {status === "再回答が必要"
                        ? "日程が変更されました"
                        : status}
                    </span>
                  )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "all", label: "終日参加" },
                    { value: "times", label: "時間指定" },
                    { value: "no", label: "不参加" },
                  ] as const
                ).map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={answer?.choice === value ? "default" : "outline"}
                    className="h-auto min-h-11 px-1 py-2 text-sm whitespace-normal"
                    aria-pressed={answer?.choice === value}
                    onClick={() => onUpdate(date, value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {answer?.choice === "times" && (
                <div className="mt-4 space-y-3">
                  {answer.times.map((range, index) => (
                    <div
                      key={range.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_2.5rem] items-center gap-2"
                    >
                      <MinuteInput
                        label={`${date.date} 開始 ${index + 1}`}
                        value={range.from}
                        onChange={(from) =>
                          onUpdate(
                            date,
                            "times",
                            answer.times.map((item) =>
                              item.id === range.id ? { ...item, from } : item
                            )
                          )
                        }
                      />
                      <span className="text-muted-foreground">〜</span>
                      <MinuteInput
                        label={`${date.date} 終了 ${index + 1}`}
                        value={range.to}
                        onChange={(to) =>
                          onUpdate(
                            date,
                            "times",
                            answer.times.map((item) =>
                              item.id === range.id ? { ...item, to } : item
                            )
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`時間帯${index + 1}を削除`}
                        onClick={() =>
                          onUpdate(
                            date,
                            "times",
                            answer.times.filter((item) => item.id !== range.id)
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onUpdate(date, "times", [
                        ...answer.times,
                        {
                          id: crypto.randomUUID(),
                          from: date.startsMinute,
                          to: date.endsMinute,
                        },
                      ])
                    }
                  >
                    <Plus className="size-4" />
                    時間帯を追加
                  </Button>
                </div>
              )}
            </fieldset>
          )
        })}
      </div>
    </>
  )
}

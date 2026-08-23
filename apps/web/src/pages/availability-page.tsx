import { useMemo, useState, type FormEvent } from "react"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, LoaderCircle, Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { getAvailability, replaceAvailability } from "@/api/availability"
import { errorMessage } from "@/api/client"
import { getYears } from "@/api/years"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"
import {
  EmptyState,
  LoadingState,
  PageBreadcrumb,
  PageHeader,
} from "@/components/page-layout"
import {
  validateAvailabilityWindows,
  type AvailabilityWindowInput,
} from "@/lib/availability-windows"

type WindowInput = AvailabilityWindowInput

function timeInJapan(value: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value))
  const part = (type: "hour" | "minute") =>
    parts.find((item) => item.type === type)?.value ?? ""
  return `${part("hour")}:${part("minute")}`
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00+09:00`))
}

function timePart(value: string): string {
  return value.length >= 16 ? value.slice(11, 16) : ""
}

function instant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString()
}

export function AvailabilityPage() {
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const activeYears = useMemo(
    () => years.data?.years.filter((year) => year.status === "active") ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? activeYears[0]?.year ?? null
  const availability = useQuery({
    queryKey: ["availability", year],
    queryFn: year === null ? skipToken : () => getAvailability(year),
  })

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <PageBreadcrumb>
        <Button
          render={<Link to="/calendar" />}
          nativeButton={false}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft />
          カレンダー
        </Button>
      </PageBreadcrumb>
      <PageHeader title="シフト希望">
        {activeYears.length > 1 && (
          <select
            aria-label="年度"
            className={`${fieldClassName} w-auto`}
            value={year ?? ""}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {activeYears.map((item) => (
              <option key={item.year} value={item.year}>
                {item.year}年度
              </option>
            ))}
          </select>
        )}
      </PageHeader>
      {years.isPending || availability.isPending ? (
        <LoadingState />
      ) : activeYears.length === 0 ? (
        <EmptyState>現在、希望は受け付けていません</EmptyState>
      ) : availability.data && year !== null ? (
        availability.data.availability.dates.length === 0 ? (
          <EmptyState>入力日はまだ設定されていません</EmptyState>
        ) : (
          <AvailabilityForm
            key={`${year}-${availability.data.availability.updatedAt ?? "new"}`}
            year={year}
            dates={availability.data.availability.dates}
            initialWindows={availability.data.availability.windows}
          />
        )
      ) : null}
    </section>
  )
}

function AvailabilityForm({
  year,
  dates,
  initialWindows,
}: {
  year: number
  dates: string[]
  initialWindows: Array<{
    id?: string | undefined
    date: string
    startsAt: string
    endsAt: string
  }>
}) {
  const queryClient = useQueryClient()
  const [windows, setWindows] = useState<WindowInput[]>(() =>
    initialWindows.map((window) => ({
      id: window.id ?? crypto.randomUUID(),
      date: window.date,
      startsAt: `${window.date}T${timeInJapan(window.startsAt)}`,
      endsAt: `${window.date}T${timeInJapan(window.endsAt)}`,
    }))
  )
  const [pending, setPending] = useState<"draft" | "submitted" | null>(null)
  const [feedback, setFeedback] = useState<{
    message: string
    tone: "default" | "error"
  } | null>(null)
  const validation = validateAvailabilityWindows(windows)
  const groups = useMemo(
    () =>
      dates.map(
        (date) =>
          [
            date,
            windows
              .filter((window) => window.date === date)
              .toSorted((left, right) =>
                left.startsAt.localeCompare(right.startsAt)
              ),
          ] as const
      ),
    [dates, windows]
  )

  function updateWindow(id: string, update: Partial<WindowInput>) {
    setWindows((current) =>
      current.map((window) =>
        window.id === id ? { ...window, ...update } : window
      )
    )
  }

  function addWindow(date: string) {
    const previous = windows
      .filter((window) => window.date === date)
      .toSorted((left, right) => left.endsAt.localeCompare(right.endsAt))
      .at(-1)
    const start = previous ? timePart(previous.endsAt) : "09:00"
    const [hour = 9, minute = 0] = start.split(":").map(Number)
    const endTotal = hour * 60 + minute + 60
    const end =
      endTotal < 24 * 60
        ? `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`
        : "23:59"

    setWindows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        date,
        startsAt: `${date}T${start}`,
        endsAt: `${date}T${end}`,
      },
    ])
  }

  async function save(status: "draft" | "submitted") {
    if (validation) {
      setFeedback({ message: validation, tone: "error" })
      return
    }
    setPending(status)
    setFeedback(null)
    try {
      await replaceAvailability(year, {
        status,
        windows: windows.map((window) => ({
          date: window.date,
          startsAt: instant(window.date, timePart(window.startsAt)),
          endsAt: instant(window.date, timePart(window.endsAt)),
        })),
      })
      await queryClient.invalidateQueries({ queryKey: ["availability", year] })
      setFeedback({
        message:
          status === "submitted"
            ? "希望を提出しました。"
            : "下書きを保存しました。",
        tone: "default",
      })
    } catch (error) {
      setFeedback({ message: errorMessage(error), tone: "error" })
    } finally {
      setPending(null)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save("submitted")
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      {groups.map(([date, group]) => (
        <section key={date}>
          <h2 className="flex min-h-11 items-center border-b font-medium">
            {dateLabel(date)}
          </h2>
          <div className="divide-y">
            {group.map((window) => (
              <div
                key={window.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 py-3"
              >
                <input
                  type="time"
                  aria-label={`${dateLabel(date)}の開始時刻`}
                  className={fieldClassName}
                  required
                  value={timePart(window.startsAt)}
                  onChange={(event) =>
                    updateWindow(window.id, {
                      startsAt: `${date}T${event.target.value}`,
                    })
                  }
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="time"
                  aria-label={`${dateLabel(date)}の終了時刻`}
                  className={fieldClassName}
                  required
                  value={timePart(window.endsAt)}
                  onChange={(event) =>
                    updateWindow(window.id, {
                      endsAt: `${date}T${event.target.value}`,
                    })
                  }
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="時間帯を削除"
                  onClick={() =>
                    setWindows((current) =>
                      current.filter((item) => item.id !== window.id)
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="mt-2"
            type="button"
            size="sm"
            variant="ghost"
            disabled={windows.length >= 64}
            onClick={() => addWindow(date)}
          >
            <Plus />
            時間帯を追加
          </Button>
        </section>
      ))}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none md:bottom-0">
        <Button
          className="flex-1 sm:flex-none"
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => void save("draft")}
        >
          {pending === "draft" && <LoaderCircle className="animate-spin" />}
          下書き保存
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "submitted" && <LoaderCircle className="animate-spin" />}
          提出
        </Button>
      </div>
      {feedback && (
        <FeedbackNotice
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
          tone={feedback.tone}
        />
      )}
    </form>
  )
}

import { useMemo, useState, type FormEvent } from "react"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import { getAvailability, replaceAvailability } from "@/api/availability"
import { getYears } from "@/api/years"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"
import { EmptyState, LoadingState, PageHeader } from "@/components/page-layout"

type WindowInput = { id: string; startsAt: string; endsAt: string }

function toLocalInput(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
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
    <section className="mx-auto max-w-2xl space-y-6">
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
        <AvailabilityForm
          key={`${year}-${availability.data.availability.updatedAt ?? "new"}`}
          year={year}
          initialStatus={availability.data.availability.status}
          initialWindows={availability.data.availability.windows}
        />
      ) : null}
    </section>
  )
}

function AvailabilityForm({
  year,
  initialStatus,
  initialWindows,
}: {
  year: number
  initialStatus: "draft" | "submitted"
  initialWindows: Array<{ id?: string; startsAt: string; endsAt: string }>
}) {
  const queryClient = useQueryClient()
  const [windows, setWindows] = useState<WindowInput[]>(() =>
    initialWindows.map((window) => ({
      id: window.id ?? crypto.randomUUID(),
      startsAt: toLocalInput(window.startsAt),
      endsAt: toLocalInput(window.endsAt),
    }))
  )
  const [pending, setPending] = useState<"draft" | "submitted" | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function addWindow() {
    setWindows((current) => [
      ...current,
      { id: crypto.randomUUID(), startsAt: "", endsAt: "" },
    ])
  }

  async function save(status: "draft" | "submitted") {
    setPending(status)
    setMessage(null)
    try {
      await replaceAvailability(year, {
        status,
        windows: windows.map((window) => ({
          startsAt: new Date(window.startsAt).toISOString(),
          endsAt: new Date(window.endsAt).toISOString(),
        })),
      })
      await queryClient.invalidateQueries({ queryKey: ["availability", year] })
      setMessage(
        status === "submitted"
          ? "希望を提出しました。"
          : "下書きを保存しました。"
      )
    } catch (error) {
      setMessage(errorMessage(error))
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
      <div className="flex min-h-12 items-center justify-between border-y">
        <p className="text-sm font-medium">勤務できる時間帯</p>
        <span className="text-xs font-medium text-muted-foreground">
          {initialStatus === "submitted" ? "提出済み" : "下書き"}
        </span>
      </div>
      <div className="divide-y border-y">
        {windows.map((window, index) => (
          <div
            key={window.id}
            className="grid gap-3 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <p className="text-sm font-medium sm:col-span-3">
              時間帯 {index + 1}
            </p>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">開始</span>
              <input
                aria-label={`希望${index + 1}の開始`}
                type="datetime-local"
                className={fieldClassName}
                required
                value={window.startsAt}
                onChange={(event) =>
                  setWindows((current) =>
                    current.map((item) =>
                      item.id === window.id
                        ? { ...item, startsAt: event.target.value }
                        : item
                    )
                  )
                }
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">終了</span>
              <input
                aria-label={`希望${index + 1}の終了`}
                type="datetime-local"
                className={fieldClassName}
                required
                value={window.endsAt}
                onChange={(event) =>
                  setWindows((current) =>
                    current.map((item) =>
                      item.id === window.id
                        ? { ...item, endsAt: event.target.value }
                        : item
                    )
                  )
                }
              />
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="justify-self-end text-muted-foreground hover:text-destructive"
              onClick={() =>
                setWindows((current) =>
                  current.filter((item) => item.id !== window.id)
                )
              }
            >
              <Trash2 />
              <span className="sr-only">削除</span>
            </Button>
          </div>
        ))}
      </div>
      {windows.length === 0 && (
        <EmptyState>時間帯がまだ追加されていません</EmptyState>
      )}
      <Button
        className="w-full sm:w-auto"
        type="button"
        variant="outline"
        onClick={addWindow}
      >
        <Plus />
        時間帯を追加
      </Button>
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
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </form>
  )
}

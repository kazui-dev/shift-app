import { useMemo, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/lib/api"
import {
  getAvailability,
  getYears,
  replaceAvailability,
} from "@/lib/shifts-api"

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
    queryFn: () => getAvailability(year!),
    enabled: year !== null,
  })
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">勤務できる時間</p>
        <h1 className="text-xl font-medium">希望提出</h1>
      </div>
      {activeYears.length > 1 && (
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={year ?? ""}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
        >
          {activeYears.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}
            </option>
          ))}
        </select>
      )}
      {years.isPending || availability.isPending ? (
        <LoaderCircle className="animate-spin" />
      ) : activeYears.length === 0 ? (
        <p className="rounded-lg border p-4 text-muted-foreground">
          希望を受付中の年度はありません。
        </p>
      ) : availability.data && year !== null ? (
        <AvailabilityForm
          key={`${year}-${availability.data.availability.updatedAt ?? "new"}`}
          year={year}
          initialWindows={availability.data.availability.windows}
        />
      ) : null}
    </section>
  )
}

function AvailabilityForm({
  year,
  initialWindows,
}: {
  year: number
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
    <form className="space-y-4" onSubmit={submit}>
      {windows.map((window, index) => (
        <div
          key={window.id}
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            aria-label={`希望${index + 1}の開始`}
            type="datetime-local"
            className="h-10 rounded-md border bg-background px-2"
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
          <input
            aria-label={`希望${index + 1}の終了`}
            type="datetime-local"
            className="h-10 rounded-md border bg-background px-2"
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
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
      <Button type="button" variant="outline" onClick={addWindow}>
        <Plus />
        時間帯を追加
      </Button>
      {message && <p className="text-sm">{message}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => void save("draft")}
        >
          {pending === "draft" && <LoaderCircle className="animate-spin" />}
          下書き保存
        </Button>
        <Button type="submit" disabled={pending !== null}>
          {pending === "submitted" && <LoaderCircle className="animate-spin" />}
          提出
        </Button>
      </div>
    </form>
  )
}

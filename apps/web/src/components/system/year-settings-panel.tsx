import { useMemo, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import { createYear, getYears, updateYear } from "@/api/years"
import { nativeSelectClassName } from "@/components/form-styles"
import { SectionHeader } from "@/components/page-layout"

const statusLabels = {
  draft: "準備中",
  active: "運用中",
  archived: "終了",
} as const

export function YearSettingsPanel() {
  const queryClient = useQueryClient()
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? years.data?.years[0]?.year ?? null
  const currentYear = useMemo(
    () => years.data?.years.find((item) => item.year === year),
    [year, years.data]
  )
  const [yearNumber, setYearNumber] = useState(new Date().getFullYear())
  const [pending, setPending] = useState(false)

  async function refreshYears() {
    await queryClient.invalidateQueries({ queryKey: ["years"] })
  }

  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      await createYear({ year: yearNumber, status: "draft" })
      setSelectedYear(yearNumber)
      await refreshYears()
      toast.success("年度を作成しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function changeStatus(status: "draft" | "active" | "archived") {
    if (year === null) return
    setPending(true)
    try {
      await updateYear(year, { status })
      await refreshYears()
      toast.success("年度の状態を更新しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-5">
      <SectionHeader title="年度" />
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addYear}>
        <Input
          type="number"
          min="2000"
          max="2100"
          aria-label="作成する年度"
          className="h-11 sm:w-40"
          value={yearNumber}
          onChange={(event) => setYearNumber(Number(event.target.value))}
        />
        <Button type="submit" disabled={pending}>
          年度を追加
        </Button>
      </form>

      {!years.isPending && (
        <select
          aria-label="設定する年度"
          className={nativeSelectClassName}
          value={year ?? ""}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
        >
          {years.data?.years.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}年度（{statusLabels[item.status]}）
            </option>
          ))}
        </select>
      )}
      {currentYear && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted-foreground">状態</span>
          {(["draft", "active", "archived"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={currentYear.status === status ? "default" : "outline"}
              disabled={pending || currentYear.status === status}
              onClick={() => void changeStatus(status)}
            >
              {statusLabels[status]}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}

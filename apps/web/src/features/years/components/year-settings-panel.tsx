import { yearsQuery } from "@/features/years/data/years"
import { LoadingState } from "@/app/page-layout"
import { keys } from "@/app/data/keys"
import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/lib/http/client"
import { createYear, setDefaultYear } from "@/features/years/api/years"

export function YearSettingsPanel() {
  const queryClient = useQueryClient()
  const years = useQuery({ ...yearsQuery })
  const [yearNumber, setYearNumber] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const nextYear =
    yearNumber ??
    Math.max(
      new Date().getFullYear() - 1,
      ...(years.data?.years.map((item) => item.year) ?? [])
    ) + 1
  const exists =
    years.data?.years.some((item) => item.year === nextYear) ?? false

  async function refreshYears() {
    await queryClient.invalidateQueries({ queryKey: keys.years() })
  }

  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      await createYear({ year: nextYear })
      setYearNumber(null)
      await refreshYears()
      toast.success("年度を作成しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function changeDefault(year: number) {
    setPending(true)
    try {
      await setDefaultYear(year)
      await refreshYears()
      toast.success("デフォルト年度を変更しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-6">
      {years.isPending && <LoadingState />}
      {years.isError && (
        <p role="alert">
          年度を読み込めませんでした。
          <Button variant="ghost" onClick={() => void years.refetch()}>
            再読み込み
          </Button>
        </p>
      )}
      <fieldset disabled={pending}>
        <legend className="mb-3 text-sm font-medium">デフォルト年度</legend>
        <div className="divide-y border-y">
          {years.data?.years.map((item) => (
            <label
              key={item.year}
              className="flex min-h-14 cursor-pointer items-center gap-3 text-sm"
            >
              <input
                className="accent-foreground"
                type="radio"
                name="default-year"
                value={item.year}
                checked={item.isDefault}
                onChange={() => void changeDefault(item.year)}
              />
              <span>{item.year}年度</span>
              {item.isDefault && (
                <span className="ml-auto text-xs text-muted-foreground">
                  設定中
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <form className="flex items-end gap-3" onSubmit={addYear}>
        <label className="flex flex-col gap-2 text-sm" htmlFor="new-year">
          年度を追加
          <Input
            id="new-year"
            type="number"
            min="2000"
            max="2100"
            required
            className="w-32"
            value={nextYear}
            onChange={(event) => setYearNumber(Number(event.target.value))}
          />
        </label>
        <Button
          type="submit"
          variant="outline"
          disabled={pending || years.isPending || exists}
        >
          追加
        </Button>
      </form>
      {exists && (
        <p className="text-sm text-muted-foreground">
          この年度は追加済みです。
        </p>
      )}
    </section>
  )
}

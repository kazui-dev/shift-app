import { yearsQuery } from "@/data/years"
import { LoadingState } from "@/components/page-layout"
import { keys } from "@/data/keys"
import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { errorMessage } from "@/api/client"
import { createYear, setDefaultYear } from "@/api/years"

export function YearSettingsPanel() {
  const queryClient = useQueryClient()
  const years = useQuery({ ...yearsQuery })
  const [yearNumber, setYearNumber] = useState(new Date().getFullYear())
  const [pending, setPending] = useState(false)

  async function refreshYears() {
    await queryClient.invalidateQueries({ queryKey: keys.years() })
  }

  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      await createYear({ year: yearNumber })
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
    <section className="space-y-5">
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

      {years.isPending && <LoadingState />}
      <div className="divide-y divide-border/70">
        {years.data?.years.map((item) => (
          <div
            key={item.year}
            className="flex min-h-16 items-center justify-between gap-4 py-3"
          >
            <span className="font-medium tabular-nums">{item.year}</span>
            {item.isDefault ? (
              <span className="text-sm text-muted-foreground">デフォルト</span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void changeDefault(item.year)}
              >
                デフォルトにする
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

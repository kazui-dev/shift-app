import { useMemo, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import { createYear, getYears, updateYear } from "@/api/years"
import { YearMembershipManager } from "@/components/system/year-membership-manager"
import { YearRoleManager } from "@/components/system/year-role-manager"

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
  const [message, setMessage] = useState<string | null>(null)

  async function refreshYears() {
    await queryClient.invalidateQueries({ queryKey: ["years"] })
  }

  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await createYear({ year: yearNumber, status: "draft" })
      setSelectedYear(yearNumber)
      await refreshYears()
      setMessage("年度を作成しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function changeStatus(status: "draft" | "active" | "archived") {
    if (year === null) return
    setPending(true)
    setMessage(null)
    try {
      await updateYear(year, { status })
      await refreshYears()
      setMessage("年度の状態を更新しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <h2 className="font-medium">年度と権限</h2>
      <form className="flex gap-2" onSubmit={addYear}>
        <input
          type="number"
          min="2000"
          max="2100"
          className="h-10 rounded-md border bg-background px-3"
          value={yearNumber}
          onChange={(event) => setYearNumber(Number(event.target.value))}
        />
        <Button disabled={pending}>年度を作成</Button>
      </form>

      {years.isPending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <select
          className="h-10 w-full rounded-md border bg-background px-3"
          value={year ?? ""}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
        >
          {years.data?.years.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}（{item.status}）
            </option>
          ))}
        </select>
      )}
      {currentYear && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">状態:</span>
          {(["draft", "active", "archived"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={currentYear.status === status ? "default" : "outline"}
              disabled={pending || currentYear.status === status}
              onClick={() => void changeStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      )}

      {year !== null && (
        <>
          <YearMembershipManager key={`membership-${year}`} year={year} />
          <YearRoleManager key={`roles-${year}`} year={year} />
        </>
      )}
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}

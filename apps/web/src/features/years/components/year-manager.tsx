import { QueryError } from "@/components/query-error"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTable } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { DataTable } from "@workspace/ui/components/data-table"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { emptyFilter } from "@workspace/ui/lib/filters"
import { toast } from "@workspace/ui/lib/toast"
import { keys } from "@/app/data/keys"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import type { ManagementTableView } from "@/features/management/management-context"
import { useCurrentTime } from "@/lib/hooks/use-current-time"
import { errorMessage } from "@/lib/http/client"
import { createYear, setDefaultYear } from "../api/years"
import { yearsQuery } from "../data/years"
import { yearTableColumns, type YearTableRow } from "./year-table-columns"

const emptyYears: YearTableRow[] = []
export function YearManager({
  view,
  onDirtyChange,
  onPendingChange,
}: {
  view: ManagementTableView
  onPendingChange?: ((pending: boolean) => void) | undefined
  onDirtyChange: (dirty: boolean) => void
}) {
  const now = useCurrentTime()
  const client = useQueryClient()
  const years = useQuery(yearsQuery)
  const data = years.data?.years ?? emptyYears
  const [yearNumber, setYearNumber] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    onPendingChange?.(pending)
    return () => onPendingChange?.(false)
  }, [pending, onPendingChange])
  const defaultFilter = view.filters?.default ?? emptyFilter()
  useEffect(() => {
    onDirtyChange(yearNumber !== null || pending)
    return () => onDirtyChange(false)
  }, [yearNumber, pending, onDirtyChange])
  const nextYear =
    yearNumber ??
    Math.max(now.getFullYear() - 1, ...data.map((item) => item.year)) + 1
  const exists = data.some((item) => item.year === nextYear)
  const refreshYears = useCallback(
    () => client.invalidateQueries({ queryKey: keys.years() }),
    [client]
  )
  const changeDefault = useCallback(
    async (year: number) => {
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
    },
    [refreshYears]
  )
  async function addYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || exists) return
    setPending(true)
    try {
      await createYear({ year: nextYear })
      setYearNumber(null)
      setAdding(false)
      await refreshYears()
      toast.success("年度を作成しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  const columns = useMemo(
    () => yearTableColumns(pending, (year) => void changeDefault(year)),
    [pending, changeDefault]
  )
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (item) => String(item.year),
    enableRowSelection: false,
    state: {
      columnFilters: [
        { id: "year", value: view.search },
        { id: "default", value: defaultFilter },
      ],
    },
  })
  return (
    <div>
      <ManagementHeaderActions>
        <Button
          size="sm"
          disabled={pending || !years.isSuccess}
          onClick={() => setAdding(true)}
        >
          <Plus />
          年度を作成
        </Button>
      </ManagementHeaderActions>
      {years.isError && (
        <QueryError
          message="年度を読み込めませんでした。"
          onRetry={() => years.refetch()}
        />
      )}
      <DataTable
        table={table}
        label="年度一覧"
        columnFilters={{
          year: {
            kind: "text",
            label: "年度",
            value: view.search,
            onChange: (value) => view.save({ search: value }),
          },
          default: {
            kind: "choices",
            label: "デフォルト年度",
            searchable: false,
            optionsReady: true,
            options: [
              { value: "default", label: "設定中" },
              { value: "other", label: "未設定" },
            ],
            value: defaultFilter,
            onChange: (value) => view.save({ filters: { default: value } }),
          },
        }}
        empty={years.isSuccess ? "条件に一致する年度がありません。" : undefined}
      />
      <ResponsiveDialog
        title="年度を作成"
        open={adding}
        onOpenChange={(open) => {
          if (open || pending) return
          if (yearNumber !== null) setDiscarding(true)
          else setAdding(false)
        }}
      >
        <form onSubmit={addYear} className="space-y-4">
          <label htmlFor="new-year" className="flex flex-col gap-2 text-sm">
            年度
            <Input
              id="new-year"
              type="number"
              min="2000"
              max="2100"
              required
              disabled={pending}
              value={nextYear}
              onChange={(event) => setYearNumber(Number(event.target.value))}
            />
          </label>
          {exists && (
            <p className="text-sm text-muted-foreground">
              この年度は追加済みです。
            </p>
          )}
          <div className="flex justify-end">
            <Button
              data-save-shortcut
              size="sm"
              type="submit"
              disabled={pending || !years.isSuccess || exists}
            >
              {pending ? "作成中…" : "作成"}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
      {discarding && (
        <ConfirmDialog
          title="入力した年度を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setDiscarding(false)}
          onConfirm={() => {
            setYearNumber(null)
            setDiscarding(false)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

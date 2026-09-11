import { displayYearQuery } from "@/data/years"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/lib/toast"
import { setDisplayYear } from "@/api/years"
import { errorMessage } from "@/api/client"
import { useDisplayYear } from "@/components/use-display-year"
import { nativeSelectClassName } from "@/components/form-styles"
import { PushControl } from "@/components/push-control"
import { PageHeader } from "@/components/page-layout"
import { useTheme } from "@/components/theme-context"
export function SettingsPage() {
  const display = useDisplayYear()
  const client = useQueryClient()
  const changeYear = useMutation({
    mutationFn: setDisplayYear,
    onMutate: async (year) => {
      await client.cancelQueries({ queryKey: ["display-year"] })
      const previous = client.getQueryData(displayYearQuery.queryKey)
      if (previous)
        client.setQueryData(displayYearQuery.queryKey, { ...previous, year })
      return previous
    },
    onSuccess: (data) => {
      client.setQueryData(["display-year"], data)
    },
    onError: (error, _year, previous) => {
      if (previous) client.setQueryData(displayYearQuery.queryKey, previous)
      toast.error(errorMessage(error))
    },
  })
  const { theme, setTheme } = useTheme()

  return (
    <section className="w-full min-w-0 space-y-8">
      <PageHeader title="設定" />
      <div className="flex min-h-18 items-center justify-between gap-4 border-y py-3">
        <label htmlFor="display-year" className="font-medium">
          表示年度
        </label>
        {display.isPending ? (
          <span className="h-9 w-24" />
        ) : display.year === null ? (
          <span className="text-sm text-muted-foreground">
            参加年度がありません
          </span>
        ) : (
          <select
            id="display-year"
            className={cn(nativeSelectClassName, "w-auto")}
            value={display.year}
            disabled={changeYear.isPending}
            onChange={(event) => changeYear.mutate(Number(event.target.value))}
          >
            {display.data?.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium text-muted-foreground">外観</h2>
        <div className="flex min-h-18 items-center justify-between gap-4 border-y py-3">
          <span className="shrink-0 font-medium">テーマ</span>
          <div
            className="flex gap-1 rounded-lg bg-muted p-1"
            aria-label="テーマ"
          >
            {(
              [
                ["system", "自動"],
                ["light", "ライト"],
                ["dark", "ダーク"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`min-h-9 rounded-md px-4 text-sm transition-colors ${theme === value ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground"}`}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium text-muted-foreground">通知</h2>
        <div className="flex min-h-18 items-center justify-between gap-4 border-y py-3">
          <label className="font-medium" htmlFor="push-notifications">
            通知
          </label>
          <PushControl />
        </div>
      </div>
    </section>
  )
}

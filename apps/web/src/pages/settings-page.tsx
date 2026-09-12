import { displayYearQuery } from "@/data/years"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/lib/toast"
import { setDisplayYear } from "@/api/years"
import { errorMessage } from "@/api/client"
import { useDisplayYear } from "@/components/use-display-year"
import { SelectField } from "@/components/select-field"
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
    <section className="w-full min-w-0 space-y-8 py-6">
      <PageHeader title="設定" className="min-h-0 px-4 sm:px-6" />
      <div className="flex min-h-18 items-center justify-between gap-4 border-y px-4 py-3 sm:px-6">
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
          <SelectField
            id="display-year"
            className="w-auto"
            value={display.year}
            disabled={changeYear.isPending}
            onValueChange={(value) => changeYear.mutate(Number(value))}
            options={(display.data?.years ?? []).map((year) => ({
              value: year,
              label: String(year),
            }))}
          />
        )}
      </div>

      <div>
        <h2 className="mb-3 px-4 text-xs font-medium text-muted-foreground sm:px-6">
          外観
        </h2>
        <div className="flex min-h-18 items-center justify-between gap-4 border-y px-4 py-3 sm:px-6">
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
        <h2 className="mb-3 px-4 text-xs font-medium text-muted-foreground sm:px-6">
          通知
        </h2>
        <PushControl />
      </div>
    </section>
  )
}

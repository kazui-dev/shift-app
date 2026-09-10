import { PushControl } from "@/components/push-control"
import { PageHeader } from "@/components/page-layout"
import { useTheme } from "@/components/theme-context"
export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="設定" />

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

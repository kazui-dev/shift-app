import { PushControl } from "@/components/push-control"
import { PageHeader } from "@/components/page-layout"
import { useTheme } from "@/components/theme-context"
export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="設定" />

      <div>
        <h2 className="mb-2 text-xs font-medium text-muted-foreground">外観</h2>
        <div className="flex min-h-16 items-center justify-between gap-4 border-y py-3">
          <span className="shrink-0 font-medium">テーマ</span>
          <div className="flex rounded-lg bg-muted p-0.5" aria-label="テーマ">
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
                className={`min-h-9 rounded-md px-3 text-sm transition-colors ${theme === value ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground"}`}
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
        <h2 className="mb-2 text-xs font-medium text-muted-foreground">通知</h2>
        <div className="flex min-h-16 items-center justify-between gap-4 border-y py-3">
          <span className="font-medium">通知</span>
          <PushControl />
        </div>
      </div>
    </section>
  )
}

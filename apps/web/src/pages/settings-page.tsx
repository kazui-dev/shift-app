import { PushControl } from "@/components/push-control"
import { PageHeader } from "@/components/page-layout"
import { useTheme } from "@/components/theme-context"
import { fieldClassName } from "@/components/form-styles"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <section className="space-y-8">
      <PageHeader title="設定" />

      <div className="divide-y border-y">
        <div className="flex min-h-16 items-center justify-between gap-4 py-3">
          <label htmlFor="theme" className="shrink-0 font-medium">
            テーマ
          </label>
          <select
            id="theme"
            className={`${fieldClassName} max-w-48`}
            value={theme}
            onChange={(event) => {
              const nextTheme = event.target.value
              if (
                nextTheme === "system" ||
                nextTheme === "light" ||
                nextTheme === "dark"
              ) {
                setTheme(nextTheme)
              }
            }}
          >
            <option value="system">端末の設定</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </div>

        <div className="flex min-h-16 items-center justify-between gap-4 py-3">
          <span className="font-medium">シフト通知</span>
          <PushControl />
        </div>
      </div>
    </section>
  )
}

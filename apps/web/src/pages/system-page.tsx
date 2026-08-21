import { AdminPanel } from "@/components/admin-panel"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"

export function SystemPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">管理者専用</p>
        <h1 className="text-xl font-medium">システム設定</h1>
      </div>

      <YearSettingsPanel />
      <AdminPanel />
    </section>
  )
}

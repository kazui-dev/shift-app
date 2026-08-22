import { AdminPanel } from "@/components/admin-panel"
import { YearSettingsPanel } from "@/components/system/year-settings-panel"
import { PageHeader } from "@/components/page-layout"

export function SystemPage() {
  return (
    <section className="space-y-10">
      <PageHeader title="管理" />

      <YearSettingsPanel />
      <AdminPanel />
    </section>
  )
}

import { EmptyState } from "@/app/page-layout"
import {
  useManagement,
  useManagementScreenView,
} from "@/features/management/management-context"
import { ManagementPageFrame } from "@/features/management/pages/page-frame"
import { ActivityManager } from "../components/activity-manager"

export function ShiftListPage() {
  const {
    years: { year },
  } = useManagement()
  const view = useManagementScreenView(`shifts:${year}`)
  return (
    <ManagementPageFrame title="シフト" viewKey={`shifts:${year}`} flushTop>
      {year === null ? (
        <EmptyState>管理できる年度がありません</EmptyState>
      ) : (
        <ActivityManager key={year} year={year} view={view} />
      )}
    </ManagementPageFrame>
  )
}

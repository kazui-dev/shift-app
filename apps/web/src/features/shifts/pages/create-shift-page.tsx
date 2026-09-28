import { EmptyState } from "@/app/page-layout"
import { useManagement } from "@/features/management/management-context"
import { CreateShift } from "../components/create-shift"

export function CreateShiftPage() {
  const {
    years: { year },
  } = useManagement()
  return year === null ? (
    <EmptyState>管理できる年度がありません</EmptyState>
  ) : (
    <CreateShift key={year} year={year} />
  )
}

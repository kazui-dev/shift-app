import { ViewSwitch } from "@workspace/ui/components/view-switch"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { ShiftOverview } from "../components/shift-overview"
import { useShiftView } from "../shift-view-context"
import { EmptyState } from "@/app/page-layout"
import { useManagement } from "@/features/management/management-context"
import { ManagementPageFrame } from "@/features/management/pages/page-frame"
import { ActivityManager } from "../components/activity-manager"

export function ShiftListPage() {
  const {
    years: { year },
  } = useManagement()
  return year === null ? (
    <ManagementPageFrame
      title="シフト"
      titleInNavigation
      viewKey={`shifts:${year}`}
    >
      <EmptyState>管理できる年度がありません</EmptyState>
    </ManagementPageFrame>
  ) : (
    <ShiftViews key={year} year={year} />
  )
}

function ShiftViews({ year }: { year: number }) {
  const [switchTo, setSwitchTo] = useState<"list" | "overview" | null>(null)
  const [status, setStatus] = useState({ dirty: false, pending: false })
  const saved = useShiftView(year)
  const mode = saved.mode ?? "list"
  const navigation = (
    <ViewSwitch
      label="シフトの表示"
      options={[
        { id: "list", label: "シフト別" },
        { id: "overview", label: "全体" },
      ]}
      value={mode}
      disabled={status.pending}
      onChange={(next) => {
        if (status.dirty) setSwitchTo(next)
        else saved.save({ mode: next })
      }}
    />
  )
  return (
    <ManagementPageFrame
      title="シフト"
      titleInNavigation
      viewKey={`shifts:${year}:${mode}`}
      scrollable={mode === "list"}
      contentWidth="full"
      pending={status.pending}
      headerTrailing={navigation}
      headerActions={
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            disabled={status.pending}
            render={<Link to="/manage/shifts/availability" />}
          >
            シフト希望フォーム
          </Button>
          <Button
            size="sm"
            nativeButton={false}
            disabled={status.pending}
            render={<Link to="/manage/shifts/new" />}
          >
            <Plus />
            シフトを作成
          </Button>
        </div>
      }
    >
      {switchTo && (
        <ConfirmDialog
          title="未保存の変更を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setSwitchTo(null)}
          onConfirm={() => {
            saved.save({ mode: switchTo })
            setSwitchTo(null)
          }}
        />
      )}
      {mode === "overview" ? (
        <ShiftOverview year={year} onStatusChange={setStatus} />
      ) : (
        <ActivityManager year={year} />
      )}
    </ManagementPageFrame>
  )
}

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
    <div className="flex shrink-0 gap-2" aria-label="シフトの表示">
      {(
        [
          { id: "list", label: "シフト別" },
          { id: "overview", label: "全体" },
        ] as const
      ).map((item) => (
        <Button
          key={item.id}
          variant={mode === item.id ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={mode === item.id}
          disabled={status.pending}
          onClick={() => {
            if (mode === item.id) return
            if (status.dirty) {
              setSwitchTo(item.id)
              return
            }
            saved.save({ mode: item.id })
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
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

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { ShiftViewToolbar } from "../components/shift-view-toolbar"
import { ShiftOverview } from "../components/shift-overview"
import { useShiftView } from "../shift-view-context"
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
  return year === null ? (
    <ManagementPageFrame title="シフト" viewKey={`shifts:${year}`} flushTop>
      <EmptyState>管理できる年度がありません</EmptyState>
    </ManagementPageFrame>
  ) : (
    <ShiftViews key={year} year={year} view={view} />
  )
}

function ShiftViews({
  year,
  view,
}: {
  year: number
  view: Parameters<typeof ActivityManager>[0]["view"]
}) {
  const { dirty } = useManagement()
  const [switchTo, setSwitchTo] = useState<"list" | "overview" | null>(null)
  const saved = useShiftView(year)
  const [mode, setMode] = useState(saved.mode ?? "list")
  const navigation = (
    <div className="flex gap-2" aria-label="シフトの表示">
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
          onClick={() => {
            if (mode === item.id) return
            if (dirty) {
              setSwitchTo(item.id)
              return
            }
            setMode(item.id)
            saved.save({ mode: item.id })
          }}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
  return (
    <ManagementPageFrame title="シフト" viewKey={`shifts:${year}`} flushTop>
      {switchTo && (
        <ConfirmDialog
          title="未保存の変更を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setSwitchTo(null)}
          onConfirm={() => {
            setMode(switchTo)
            saved.save({ mode: switchTo })
            setSwitchTo(null)
          }}
        />
      )}
      {mode === "overview" ? (
        <ShiftOverview year={year} navigation={navigation} />
      ) : (
        <>
          <ShiftViewToolbar navigation={navigation} />
          <ActivityManager year={year} view={view} />
        </>
      )}
    </ManagementPageFrame>
  )
}

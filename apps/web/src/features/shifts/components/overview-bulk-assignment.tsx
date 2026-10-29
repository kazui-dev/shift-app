import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { SelectField } from "@/components/select-field"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { activityQuery } from "../data/activities"
import { BulkAssignmentDialog } from "./bulk-assignment-dialog"
import { planOf } from "./use-shift-plan"
import type { OverviewDraft, OverviewDrafts } from "./overview-draft"

export function OverviewBulkAssignment({
  data,
  memberIds,
  drafts,
  onApply,
  onClose,
}: {
  data: ShiftOverview
  memberIds: string[]
  drafts: OverviewDrafts
  onApply: (id: string, draft: OverviewDraft) => void
  onClose: () => void
}) {
  const [activityId, setActivityId] = useState("")
  const query = useQuery({
    ...activityQuery(activityId),
    enabled: !!activityId,
    staleTime: 0,
    refetchOnMount: "always",
  })
  const selector = (
    <div className="space-y-2 text-sm">
      シフト
      <SelectField
        searchable
        aria-label="一括割当するシフト"
        value={activityId}
        onValueChange={setActivityId}
        options={[
          { value: "", label: "シフトを選択" },
          ...data.activities.map((item) => ({
            value: item.id,
            label: item.name,
          })),
        ]}
      />
    </div>
  )
  const source = query.data
  if (!source || query.isFetching || query.isError)
    return (
      <ResponsiveDialog
        open
        title="一括割当"
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        className="md:max-w-xl"
        bodyClassName="space-y-4 py-4"
      >
        {selector}
        {query.isFetching && (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        )}
        {query.isError && (
          <p role="alert" className="text-sm text-destructive">
            読み込めませんでした。
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              再試行
            </Button>
          </p>
        )}
      </ResponsiveDialog>
    )
  return (
    <BulkAssignmentDialog
      key={activityId}
      activitySelector={selector}
      data={source}
      memberIds={memberIds}
      plan={drafts[activityId]?.plan ?? planOf(source)}
      onClose={onClose}
      onApply={(plan) =>
        onApply(activityId, {
          base: drafts[activityId]?.base ?? planOf(source),
          plan,
        })
      }
    />
  )
}

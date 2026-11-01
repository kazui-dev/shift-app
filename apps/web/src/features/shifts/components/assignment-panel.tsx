import { removeAssignments } from "./assignment-removal"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { activitiesQuery, activityQuery } from "../data/activities"
import type { EditorData } from "../editor-data"
import type { ShiftAnchor } from "./shift-anchor"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"
import type { OverviewDrafts } from "./overview-draft"
import { planOf } from "./use-shift-plan"
import { assignMember } from "./assign-member"
import { transferAssignment } from "./transfer-assignment"
import { errorMessage } from "@/lib/http/client"
import { useEffect, useRef, useState } from "react"
import { ConfirmDialog } from "@/components/confirm-dialog"

export function AssignmentPanel({
  source,
  activityId,
  selection,
  anchor,
  drafts,
  pending,
  onApply,
  onClose,
}: {
  source: EditorData
  activityId: string
  selection: ShiftSelection
  anchor: ShiftAnchor
  drafts: OverviewDrafts
  pending: boolean
  onApply: (updates: OverviewDrafts) => void
  onClose: () => void
}) {
  const client = useQueryClient()
  const request = useRef({ active: true, activityId, selection })
  useEffect(() => {
    const current = { active: true, activityId, selection }
    request.current = current
    return () => {
      current.active = false
    }
  }, [activityId, selection])
  const [confirmation, setConfirmation] = useState<OverviewDrafts | null>(null)
  const catalog = useQuery(activitiesQuery(source.activity.year))
  const query = useQuery({
    ...activityQuery(activityId),
    enabled: activityId !== source.activity.id,
  })
  const loaded = activityId === source.activity.id ? source : query.data
  // The clicked bar already supplies its time and member; render it immediately while fetching edit permissions/data.
  const data: EditorData = loaded ?? {
    ...source,
    activity: {
      ...source.activity,
      ...catalog.data?.activities.find((a) => a.id === activityId),
      id: activityId,
    },
    assignmentStates: [],
    slots: selection.slotId
      ? [
          {
            id: selection.slotId,
            startsAt: selection.startsAt,
            endsAt: selection.endsAt,
            capacity: null,
            memberIds: [selection.memberId],
          },
        ]
      : [],
  }
  const plan = drafts[activityId]?.plan ?? planOf(data)
  function apply(
    updates: OverviewDrafts,
    target: EditorData,
    value: ShiftSelection
  ) {
    if (
      target.activity.id !== source.activity.id &&
      !target.availability.some(
        (w) =>
          w.memberId === value.memberId &&
          Date.parse(w.startsAt) <= Date.parse(value.startsAt) &&
          Date.parse(w.endsAt) >= Date.parse(value.endsAt)
      )
    ) {
      setConfirmation(updates)
      return
    }
    onApply(updates)
    onClose()
  }
  if (confirmation)
    return (
      <ConfirmDialog
        title="希望時間外の勤務を反映しますか"
        confirmLabel="反映する"
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          onApply(confirmation)
          onClose()
        }}
      />
    )
  return (
    <ShiftSelectionPanel
      anchor={anchor}
      selection={selection}
      slots={plan.slots}
      startsAt={plan.startsAt}
      endsAt={plan.endsAt}
      data={{
        ...data,
        availability: data.availability.filter(
          (w) =>
            Date.parse(w.startsAt) < Date.parse(plan.endsAt) &&
            Date.parse(w.endsAt) > Date.parse(plan.startsAt)
        ),
      }}
      error={query.isError ? errorMessage(query.error) : undefined}
      pending={pending || !loaded}
      onClose={onClose}
      activities={catalog.data?.activities
        .filter(
          (a) =>
            a.id === activityId ||
            (Date.parse(a.startsAt) < Date.parse(selection.endsAt) &&
              Date.parse(a.endsAt) > Date.parse(selection.startsAt))
        )
        .map((a) => ({
          value: a.id,
          label: `${a.name}${a.active ? "" : "（無効）"}`,
        }))}
      onApply={async (value, destination = activityId) => {
        const current = request.current
        try {
          if (!loaded) return query.isError ? "読み込めませんでした。" : null
          if (destination !== activityId) {
            const target = await client.fetchQuery(activityQuery(destination))
            if (!current.active) return null
            const result = transferAssignment(loaded, target, drafts, value)
            if ("error" in result) return result.error
            apply(result.updates, target, value)
          } else {
            const result = assignMember(plan, value, [])
            if ("error" in result) return result.error
            apply(
              {
                [activityId]: {
                  base: drafts[activityId]?.base ?? planOf(loaded),
                  plan: { ...plan, slots: result.slots },
                  atomic: activityId !== source.activity.id,
                },
              },
              loaded,
              value
            )
          }
          return null
        } catch (error) {
          return errorMessage(error)
        }
      }}
      onRemove={(slotId) => {
        if (!loaded) return
        onApply({
          [activityId]: {
            base: drafts[activityId]?.base ?? planOf(loaded),
            atomic: activityId !== source.activity.id,
            plan: removeAssignments(plan, [
              { activityId, slotId, memberId: selection.memberId },
            ]),
          },
        })
        onClose()
      }}
    />
  )
}

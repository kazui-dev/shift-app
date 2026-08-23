import { useState, type FormEvent } from "react"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { valibotResolver } from "@hookform/resolvers/valibot"
import { LoaderCircle, Plus, Trash2, X } from "lucide-react"
import { useForm } from "react-hook-form"
import * as v from "valibot"

import { Button } from "@workspace/ui/components/button"

import { createActivity, getActivities, getActivity } from "@/api/activities"
import { cancelAssignment, createAssignment } from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { getRoster } from "@/api/years"
import { FeedbackNotice } from "@/components/feedback-notice"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { fieldClassName, textareaClassName } from "@/components/form-styles"
import {
  EmptyState,
  LoadingState,
  SectionHeader,
} from "@/components/page-layout"

function iso(local: string): string {
  return new Date(local).toISOString()
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

const activityFormSchema = v.pipe(
  v.object({
    name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    place: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    activityType: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
    startsAt: v.pipe(v.string(), v.minLength(1)),
    endsAt: v.pipe(v.string(), v.minLength(1)),
    color: v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/)),
    notes: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
  }),
  v.forward(
    v.check(
      (value) => Date.parse(value.startsAt) < Date.parse(value.endsAt),
      "終了日時は開始日時より後にしてください"
    ),
    ["endsAt"]
  )
)

type ActivityFormValues = v.InferOutput<typeof activityFormSchema>

export function ActivityManager({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const activities = useQuery({
    queryKey: ["activities", year],
    queryFn: () => getActivities(year),
  })
  const members = useQuery({
    queryKey: ["roster", year],
    queryFn: () => getRoster(year),
  })
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const activity = useQuery({
    queryKey: ["activity", selectedActivity],
    queryFn:
      selectedActivity === null
        ? skipToken
        : () => getActivity(selectedActivity),
  })
  const activityForm = useForm<ActivityFormValues>({
    resolver: valibotResolver(activityFormSchema),
    defaultValues: {
      name: "",
      place: "",
      activityType: "",
      startsAt: "",
      endsAt: "",
      color: "#2563EB",
      notes: "",
    },
  })
  const [memberId, setMemberId] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [pending, setPending] = useState<
    "activity" | "assignment" | "cancel" | null
  >(null)
  const [message, setMessage] = useState<string | null>(null)

  async function addActivity(values: ActivityFormValues) {
    setPending("activity")
    setMessage(null)
    try {
      await createActivity(year, {
        ...values,
        startsAt: iso(values.startsAt),
        endsAt: iso(values.endsAt),
        notes: values.notes || null,
      })
      activityForm.reset()
      setCreateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["activities", year] })
      setMessage("活動を作成しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedActivity === null || !memberId) return
    const activityId = selectedActivity
    setPending("assignment")
    setMessage(null)
    try {
      const result = await createAssignment(activityId, {
        memberId,
        notes: null,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activities", year] }),
      ])
      setMessage(
        result.warnings.includes("OUTSIDE_SUBMITTED_AVAILABILITY")
          ? "割り当てました（提出希望時間外です）。"
          : "割り当てました。"
      )
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (selectedActivity === null) return
    const activityId = selectedActivity
    setPending("cancel")
    setMessage(null)
    try {
      await cancelAssignment(assignmentId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activities", year] }),
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
      ])
      setMessage("割当を取り消しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-5">
      <SectionHeader title="活動と割当">
        <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
          <Plus />
          活動を追加
        </Button>
      </SectionHeader>
      {createOpen && (
        <section className="border-y py-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">新しい活動</h3>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="閉じる"
              onClick={() => setCreateOpen(false)}
            >
              <X />
            </Button>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={activityForm.handleSubmit(addActivity)}
          >
            <input
              className={fieldClassName}
              placeholder="活動名"
              required
              {...activityForm.register("name")}
            />
            <input
              className={fieldClassName}
              placeholder="場所"
              required
              {...activityForm.register("place")}
            />
            <input
              className={fieldClassName}
              placeholder="種別"
              required
              {...activityForm.register("activityType")}
            />
            <input
              type="color"
              aria-label="活動の色"
              className={`${fieldClassName} p-1`}
              {...activityForm.register("color")}
            />
            <label className="text-xs">
              開始
              <input
                type="datetime-local"
                className={`${fieldClassName} mt-1`}
                required
                {...activityForm.register("startsAt")}
              />
            </label>
            <label className="text-xs">
              終了
              <input
                type="datetime-local"
                className={`${fieldClassName} mt-1`}
                required
                {...activityForm.register("endsAt")}
              />
            </label>
            <textarea
              className={`${textareaClassName} sm:col-span-2`}
              placeholder="備考（任意）"
              {...activityForm.register("notes")}
            />
            {activityForm.formState.errors.endsAt?.message && (
              <p className="text-sm text-destructive sm:col-span-2">
                {activityForm.formState.errors.endsAt.message}
              </p>
            )}
            <Button className="sm:col-span-2" disabled={pending !== null}>
              {pending === "activity" && (
                <LoaderCircle className="animate-spin" />
              )}
              作成
            </Button>
          </form>
        </section>
      )}

      <div className="grid border-y md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="border-b px-4 py-3 font-medium">活動</h3>
          {activities.isPending && <LoadingState />}
          <div className="space-y-1 px-2 pb-3">
            {activities.data?.activities.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${selectedActivity === item.id ? "bg-muted" : "hover:bg-muted/60"}`}
                onClick={() => setSelectedActivity(item.id)}
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dateTime(item.startsAt)}–{dateTime(item.endsAt)} ·{" "}
                  {item.place} · {item.assignmentCount}人
                </p>
              </button>
            ))}
            {activities.data?.activities.length === 0 && (
              <EmptyState>活動はありません</EmptyState>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t md:border-t-0 md:border-l">
          <h3 className="border-b px-4 py-3 font-medium">割当</h3>
          <div className="space-y-3 px-4 pb-4">
            {selectedActivity === null && (
              <EmptyState>活動を選択してください</EmptyState>
            )}
            {selectedActivity !== null && activity.isPending && (
              <LoadingState />
            )}
            {activity.data && (
              <>
                <form className="flex gap-2" onSubmit={addAssignment}>
                  <select
                    className={`${fieldClassName} min-w-0 flex-1`}
                    required
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                  >
                    <option value="">メンバーを選択</option>
                    {members.data?.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}（{member.studentId}）
                      </option>
                    ))}
                  </select>
                  <Button disabled={pending !== null}>
                    {pending === "assignment" && (
                      <LoaderCircle className="animate-spin" />
                    )}
                    割当
                  </Button>
                </form>
                <ul className="space-y-2">
                  {activity.data.assignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex items-center justify-between gap-2 border-b py-3 last:border-0"
                    >
                      <div>
                        <p>{assignment.memberDisplayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateTime(assignment.startsAt)}–
                          {dateTime(assignment.endsAt)}
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={pending !== null}
                        onClick={() => setCancelTarget(assignment.id)}
                      >
                        <Trash2 />
                        <span className="sr-only">取消</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
      {cancelTarget && (
        <ConfirmDialog
          title="割当を取り消しますか"
          description="このメンバーの割当を取り消します。"
          confirmLabel="取り消す"
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => {
            const target = cancelTarget
            setCancelTarget(null)
            void removeAssignment(target)
          }}
        />
      )}
    </section>
  )
}

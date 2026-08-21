import { useState, type FormEvent } from "react"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { valibotResolver } from "@hookform/resolvers/valibot"
import { LoaderCircle, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import * as v from "valibot"

import { Button } from "@workspace/ui/components/button"

import { createActivity, getActivities, getActivity } from "@/api/activities"
import { cancelAssignment, createAssignment } from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { getRoster } from "@/api/years"

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
    if (
      selectedActivity === null ||
      !window.confirm("この割当を取り消しますか？")
    )
      return
    const activityId = selectedActivity
    setPending("cancel")
    setMessage(null)
    try {
      await cancelAssignment(assignmentId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity", activityId] }),
        queryClient.invalidateQueries({ queryKey: ["activities", year] }),
        queryClient.invalidateQueries({ queryKey: ["timeline"] }),
      ])
      setMessage("割当を取り消しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-5">
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">活動を作成</summary>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={activityForm.handleSubmit(addActivity)}
        >
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="活動名"
            required
            {...activityForm.register("name")}
          />
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="場所"
            required
            {...activityForm.register("place")}
          />
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="種別"
            required
            {...activityForm.register("activityType")}
          />
          <input
            type="color"
            className="h-10 w-full rounded-md border bg-background px-1"
            {...activityForm.register("color")}
          />
          <label className="text-xs">
            開始
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              required
              {...activityForm.register("startsAt")}
            />
          </label>
          <label className="text-xs">
            終了
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              required
              {...activityForm.register("endsAt")}
            />
          </label>
          <textarea
            className="min-h-20 rounded-md border bg-background p-3 sm:col-span-2"
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
      </details>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-medium">活動</h2>
          {activities.isPending && <LoaderCircle className="animate-spin" />}
          {activities.data?.activities.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-lg border p-3 text-left ${selectedActivity === item.id ? "border-foreground" : ""}`}
              onClick={() => setSelectedActivity(item.id)}
            >
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {dateTime(item.startsAt)}–{dateTime(item.endsAt)} · {item.place}{" "}
                · {item.assignmentCount}人
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="font-medium">割当</h2>
          {selectedActivity === null && (
            <p className="text-sm text-muted-foreground">
              活動を選択してください。
            </p>
          )}
          {activity.isPending && <LoaderCircle className="animate-spin" />}
          {activity.data && (
            <>
              <form className="flex gap-2" onSubmit={addAssignment}>
                <select
                  className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2"
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
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
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
                      onClick={() => void removeAssignment(assignment.id)}
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
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}

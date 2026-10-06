import { useRef, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import { rolesQuery, rosterQuery } from "@/features/years/data/years"
import { activitiesQuery } from "@/features/shifts/data/activities"
import { keys } from "@/app/data/keys"
import { TargetPicker } from "./target-picker"
import { createActivity } from "@/features/shifts/api/activities"
import { errorMessage } from "@/lib/http/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { japanLocalDateTime } from "@workspace/shared/japan-time"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

export function CreateShift({ year }: { year: number }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const roles = useQuery(rolesQuery(year))
  const roster = useQuery(rosterQuery(year))
  const allowNavigation = useRef(false)
  const [responsibles, setResponsibles] = useState<
    ActivityEditorInput["responsibles"]
  >([])
  const [candidateRoleIds, setCandidateRoleIds] = useState<string[]>([])
  const [name, setName] = useState("")
  const [place, setPlace] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [pending, setPending] = useState(false)
  const dirty =
    !!name ||
    !!place ||
    !!from ||
    !!to ||
    responsibles.length > 0 ||
    candidateRoleIds.length > 0
  const startsAt = japanLocalDateTime(from)
  const endsAt = japanLocalDateTime(to)
  const validRange =
    !!from && !!to && Number.isFinite(startsAt) && endsAt > startsAt
  const blocker = useBlocker({
    shouldBlockFn: () => !allowNavigation.current && (dirty || pending),
    enableBeforeUnload: dirty,
    withResolver: true,
  })

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!validRange || responsibles.length === 0) return
    setPending(true)
    try {
      const { activity } = await createActivity(year, {
        name,
        place,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        activityType: "シフト",
        color: "#64748B",
        notes: null,
        responsibles,
        candidateRoleIds,
      })
      client.setQueryData(activitiesQuery(year).queryKey, (current) =>
        current
          ? {
              activities: [
                ...current.activities,
                {
                  ...activity,
                  assignmentCount: 0,
                  requirements: [],
                  responsibleNames: responsibles.flatMap((target) => {
                    const responsibleName =
                      target.targetType === "role"
                        ? roles.data?.roles.find(
                            (role) => role.id === target.targetId
                          )?.name
                        : roster.data?.members.find(
                            (member) => member.id === target.targetId
                          )?.displayName
                    return responsibleName ? [responsibleName] : []
                  }),
                },
              ],
            }
          : undefined
      )
      void client.invalidateQueries({ queryKey: keys.activities(year) })
      allowNavigation.current = true
      await navigate({
        to: "/manage/shifts/$shiftId",
        params: { shiftId: activity.id },
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader className="sm:px-6">
        <Link
          to="/manage/shifts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← シフト一覧
        </Link>
        <h2 className="flex-1 text-base font-medium">シフトを作成</h2>
        <span className="text-sm text-muted-foreground">{year}年度</span>
      </PageHeader>
      <form onSubmit={create} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto px-4 py-6 sm:px-6">
          <fieldset disabled={pending} className="mx-auto max-w-2xl space-y-5">
            <label htmlFor="new-shift-name" className="block space-y-2 text-sm">
              シフト名
              <Input
                id="new-shift-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label
              htmlFor="new-shift-place"
              className="block space-y-2 text-sm"
            >
              場所（任意）
              <Input
                id="new-shift-place"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
              />
            </label>
            <label
              htmlFor="new-shift-start"
              className="block space-y-2 text-sm"
            >
              開始
              <Input
                id="new-shift-start"
                type="datetime-local"
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label htmlFor="new-shift-end" className="block space-y-2 text-sm">
              終了
              <Input
                id="new-shift-end"
                type="datetime-local"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            {from && to && !validRange && (
              <p role="alert" className="text-sm text-destructive">
                終了は開始より後にしてください。
              </p>
            )}
            <TargetPicker
              label="責任者（必須）"
              roles={roles.data?.roles ?? []}
              members={roster.data?.members ?? []}
              value={responsibles}
              onChange={setResponsibles}
            />
            <details>
              <summary className="cursor-pointer text-sm">対象のロール</summary>
              <div className="mt-2">
                {roles.data?.roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex min-h-10 items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={candidateRoleIds.includes(role.id)}
                      onChange={(event) =>
                        setCandidateRoleIds((ids) =>
                          event.target.checked
                            ? [...ids, role.id]
                            : ids.filter((id) => id !== role.id)
                        )
                      }
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </details>
            <div className="flex justify-end border-t pt-4">
              <Button
                size="sm"
                variant="outline"
                type="submit"
                disabled={pending || !validRange || responsibles.length === 0}
              >
                {pending ? "作成中…" : "シフトを作成"}
              </Button>
            </div>
          </fieldset>
        </div>
      </form>
      {blocker.status === "blocked" && (
        <ConfirmDialog
          title="入力を破棄して移動しますか"
          confirmLabel="移動する"
          onCancel={() => blocker.reset()}
          onConfirm={() => {
            if (!pending) blocker.proceed()
          }}
        />
      )}
    </section>
  )
}

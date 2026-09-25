import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { rolesQuery, rosterQuery } from "@/features/years/data/years"
import { activitiesQuery } from "@/features/shifts/data/activities"
import { keys } from "@/app/data/keys"
import { TargetPicker } from "./target-picker"
import { createActivity } from "@/features/shifts/api/activities"
import { errorMessage } from "@/lib/http/client"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { japanLocalDateTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  ResponsivePage,
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"

export function CreateShift({
  year,
  open,
  onClose,
}: {
  year: number
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const roles = useQuery({
    ...rolesQuery(year),
    enabled: open,
  })
  const roster = useQuery({
    ...rosterQuery(year),
    enabled: open,
  })
  const [responsibles, setResponsibles] = useState<
    ActivityEditorInput["responsibles"]
  >([])
  const [candidateRoleIds, setCandidateRoleIds] = useState<string[]>([])
  const [name, setName] = useState(""),
    [place, setPlace] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("")
  const [pending, setPending] = useState(false)
  async function create(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      const { activity } = await createActivity(year, {
        name,
        place,
        startsAt: new Date(japanLocalDateTime(from)).toISOString(),
        endsAt: new Date(japanLocalDateTime(to)).toISOString(),
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
                { ...activity, assignmentCount: 0 },
              ],
            }
          : undefined
      )
      void client.invalidateQueries({ queryKey: keys.activities(year) })
      onClose()
      await navigate({
        to: "/manage/shifts/$shiftId",
        params: { shiftId: activity.id },
        state: { managementParent: "/manage/shifts" },
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setName("")
    setPlace("")
    setFrom("")
    setTo("")
    setResponsibles([])
    setCandidateRoleIds([])
  }
  return (
    <ResponsivePage
      open={open}
      onClose={() => {
        if (!pending) onClose()
      }}
      onClosed={reset}
    >
      <form onSubmit={create} className="flex min-h-0 flex-1 flex-col">
        <ResponsivePageHeader
          title="シフトを作成"
          onBack={() => {
            if (!pending) onClose()
          }}
          action={
            <Button
              type="submit"
              size="sm"
              disabled={pending || responsibles.length === 0}
            >
              作成
            </Button>
          }
        />
        <ResponsivePageBody>
          <fieldset disabled={pending} className="space-y-5">
            <Input
              aria-label="シフト名"
              placeholder="シフト名"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              aria-label="場所"
              placeholder="場所（任意）"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
            />
            <label htmlFor="new-start" className="block space-y-2 text-sm">
              開始
              <Input
                id="new-start"
                type="datetime-local"
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label htmlFor="new-end" className="block space-y-2 text-sm">
              終了
              <Input
                id="new-end"
                type="datetime-local"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
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
                      onChange={(e) =>
                        setCandidateRoleIds((ids) =>
                          e.target.checked
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
          </fieldset>
        </ResponsivePageBody>
      </form>
    </ResponsivePage>
  )
}

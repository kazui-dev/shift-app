import { activitiesQuery } from "@/data/activities"
import { japanMonthDay, japanTime } from "@workspace/shared/japan-time"
import { rosterQuery, rolesQuery } from "@/data/years"
import { TargetPicker } from "@/components/shifts/target-picker"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { createActivity } from "@/api/activities"
import { errorMessage } from "@/api/client"
import {
  ResponsivePage,
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { SelectField } from "@/components/select-field"
import { japanLocalDateTime } from "@workspace/shared/japan-time"

export function ActivityManager({ year }: { year: number }) {
  const client = useQueryClient()
  const query = useQuery({
    ...activitiesQuery(year),
  })
  const roles = useQuery({
    ...rolesQuery(year),
  })
  const roster = useQuery({
    ...rosterQuery(year),
  })
  const [responsibles, setResponsibles] = useState<
    ActivityEditorInput["responsibles"]
  >([])
  const [candidateRoleIds, setCandidateRoleIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("")
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
      void client.invalidateQueries({ queryKey: ["activities", year] })
      setCreating(false)
      setName("")
      toast.success("シフトを作成しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          render={<Link to="/manage/shifts/availability" />}
          nativeButton={false}
        >
          シフト希望フォーム設定
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-32 flex-1"
          aria-label="シフトを検索"
          placeholder="シフトを検索"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          aria-label="状態"
          className="w-auto"
          value={filter}
          onValueChange={(value) => setFilter(value)}
          options={[
            { value: "all", label: "すべて" },
            { value: "active", label: "有効" },
            { value: "inactive", label: "無効" },
          ]}
        />
        <Button onClick={() => setCreating(true)}>シフトを作成</Button>
      </div>
      <ul className="divide-y border-y">
        {query.data?.activities
          .filter(
            (item) =>
              item.name.includes(search) &&
              (filter === "all" || item.active === (filter === "active"))
          )
          .map((item) => (
            <li key={item.id}>
              <Link
                to="/manage/shifts/$shiftId"
                params={{ shiftId: item.id }}
                className="flex min-h-18 items-center gap-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {japanMonthDay(item.startsAt)} · {japanTime(item.startsAt)}–
                    {japanTime(item.endsAt)} · {item.place}
                  </p>
                </div>
                {!item.active && (
                  <span className="text-xs text-muted-foreground">無効</span>
                )}
              </Link>
            </li>
          ))}
      </ul>
      <ResponsivePage open={creating} onClose={() => setCreating(false)}>
        <form onSubmit={create} className="flex min-h-0 flex-1 flex-col">
          <ResponsivePageHeader
            title="シフトを作成"
            onBack={() => setCreating(false)}
            action={
              <Button type="submit" size="sm" disabled={pending}>
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
                placeholder="場所"
                required
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
                label="責任者"
                roles={roles.data?.roles ?? []}
                members={roster.data?.members ?? []}
                value={responsibles}
                onChange={setResponsibles}
              />
              <details>
                <summary className="cursor-pointer text-sm">
                  対象のロール
                </summary>
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
    </div>
  )
}

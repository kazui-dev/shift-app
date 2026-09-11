import { TargetPicker } from "@/components/shifts/target-picker"
import { getYearRoles, getRoster } from "@/api/years"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { cn } from "@workspace/ui/lib/utils"
import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { getActivities, createActivity } from "@/api/activities"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { nativeSelectClassName } from "@/components/form-styles"
import { japanLocalDateTime } from "@/lib/japan-time"
import { timeLabel } from "@/components/shifts/time-label"

export function ActivityManager({ year }: { year: number }) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ["activities", year],
    queryFn: () => getActivities(year),
  })
  const roles = useQuery({
    queryKey: ["year-roles", year],
    queryFn: () => getYearRoles(year),
  })
  const roster = useQuery({
    queryKey: ["roster", year],
    queryFn: () => getRoster(year),
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
      await createActivity(year, {
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
      await client.invalidateQueries({ queryKey: ["activities", year] })
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
      <nav className="flex gap-4 border-b text-sm">
        <span className="border-b-2 border-foreground pb-3 font-medium">
          シフト一覧
        </span>
        <Link to="/manage/availability" className="pb-3 text-muted-foreground">
          シフト希望フォーム
        </Link>
      </nav>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-32 flex-1"
          aria-label="シフトを検索"
          placeholder="シフトを検索"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="状態"
          className={cn(nativeSelectClassName, "w-auto")}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">すべて</option>
          <option value="active">有効</option>
          <option value="inactive">無効</option>
        </select>
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
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      month: "numeric",
                      day: "numeric",
                    }).format(new Date(item.startsAt))}{" "}
                    · {timeLabel(item.startsAt)}–{timeLabel(item.endsAt)} ·{" "}
                    {item.place}
                  </p>
                </div>
                {!item.active && (
                  <span className="text-xs text-muted-foreground">無効</span>
                )}
              </Link>
            </li>
          ))}
      </ul>
      {creating && (
        <ResponsiveDialog
          open
          title="シフトを作成"
          onOpenChange={(open) => {
            if (!open) setCreating(false)
          }}
        >
          <form onSubmit={create} className="space-y-4">
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
            <Button disabled={pending}>作成</Button>
          </form>
        </ResponsiveDialog>
      )}
    </div>
  )
}

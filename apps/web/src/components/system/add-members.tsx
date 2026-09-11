import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  activateYearMembership,
  getYearMemberships,
  getYears,
} from "@/api/years"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { nativeSelectClassName } from "@/components/form-styles"
export function AddMembers({
  year,
  onClose,
}: {
  year: number
  onClose: () => void
}) {
  const client = useQueryClient()
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const [source, setSource] = useState(year)
  const query = useQuery({
    queryKey: ["year-memberships", source],
    queryFn: () => getYearMemberships(source),
  })
  const current = useQuery({
    queryKey: ["year-memberships", year],
    queryFn: () => getYearMemberships(year),
  })
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const items =
    query.data?.memberships.filter(
      (item) =>
        (source === year
          ? item.status !== "active"
          : item.status === "active" &&
            !current.data?.memberships.some(
              (existing) =>
                existing.member.id === item.member.id &&
                existing.status === "active"
            )) &&
        `${item.member.displayName} ${item.member.studentId}`
          .toLowerCase()
          .includes(search.toLowerCase())
    ) ?? []
  async function add() {
    setPending(true)
    const results = await Promise.allSettled(
      selected.map((id) => activateYearMembership(year, id))
    )
    const failed = selected.filter(
      (_, index) => results[index]?.status === "rejected"
    )
    await Promise.all([
      client.invalidateQueries({ queryKey: ["year-memberships", year] }),
      client.invalidateQueries({ queryKey: ["roster", year] }),
    ])
    setSelected(failed)
    setPending(false)
    if (failed.length)
      toast.error(
        `${failed.length}人の追加に失敗しました。選択したまま残しています。`
      )
    else {
      toast.success("メンバーを追加しました。")
      onClose()
    }
  }
  return (
    <ResponsiveDialog
      open
      title="メンバーを追加"
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <div className="space-y-4">
        <select
          aria-label="追加元"
          className={nativeSelectClassName}
          value={source}
          onChange={(e) => {
            setSource(Number(e.target.value))
            setSelected([])
          }}
        >
          <option value={year}>未参加のユーザー</option>
          {years.data?.years
            .filter((y) => y.year < year && y.canManage)
            .map((y) => (
              <option value={y.year} key={y.year}>
                {y.year}から選ぶ
              </option>
            ))}
        </select>
        <Input
          placeholder="名前・学籍番号で検索"
          aria-label="ユーザーを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {query.error && <p role="alert">{errorMessage(query.error)}</p>}
        <ul className="max-h-80 divide-y overflow-auto">
          {items.map((item) => (
            <li key={item.member.id}>
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(item.member.id)}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, item.member.id]
                        : ids.filter((id) => id !== item.member.id)
                    )
                  }
                />
                <span className="text-sm">
                  {item.member.displayName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.member.studentId}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Button
          disabled={pending || !selected.length}
          onClick={() => void add()}
        >
          {selected.length ? `${selected.length}人を追加` : "追加"}
        </Button>
      </div>
    </ResponsiveDialog>
  )
}

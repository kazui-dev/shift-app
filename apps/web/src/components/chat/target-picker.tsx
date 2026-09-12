import { targetKey } from "./target-key"
import { useState } from "react"
import { Search, X } from "lucide-react"
import type { ChatTargetOption } from "@workspace/shared/communications"
import { Input } from "@workspace/ui/components/input"
import { TargetAvatar } from "./target-avatar"

const kinds = [
  { type: "member", name: "メンバー" },
  { type: "role", name: "ロール" },
  { type: "activity", name: "シフト" },
] as const

export function TargetPicker({
  targets,
  selected,
  onChange,
}: {
  targets: ChatTargetOption[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [kind, setKind] = useState<ChatTargetOption["targetType"]>("member")
  const [search, setSearch] = useState("")
  const toggle = (key: string) =>
    onChange(
      selected.includes(key)
        ? selected.filter((value) => value !== key)
        : [...selected, key]
    )
  const candidates = targets.filter(
    (target) =>
      target.targetType === kind &&
      target.displayName
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
  )
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {kinds.map((group) => {
          const values = targets.filter(
            (target) =>
              target.targetType === group.type &&
              selected.includes(targetKey(target))
          )
          if (!values.length) return null
          return (
            <ul
              key={group.type}
              aria-label={`選択した${group.name}`}
              data-horizontal-scroll
              className="flex gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none]"
            >
              {values.map((target) => (
                <li
                  key={targetKey(target)}
                  className="relative flex w-16 shrink-0 flex-col items-center gap-1.5 pt-1"
                >
                  <TargetAvatar target={target} className="size-11 text-sm" />
                  <span
                    className="w-full truncate text-center text-xs"
                    title={target.displayName}
                  >
                    {target.displayName}
                  </span>
                  <button
                    type="button"
                    aria-label={`${target.displayName}の選択を解除`}
                    onClick={() => toggle(targetKey(target))}
                    className="absolute top-0 right-0 flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground hover:bg-accent active:bg-accent"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )
        })}
      </div>
      <div className="space-y-3">
        <div
          aria-label="対象の種類"
          className="flex gap-1 rounded-lg bg-muted/50 p-1"
        >
          {kinds.map((group) => (
            <button
              key={group.type}
              type="button"
              aria-pressed={kind === group.type}
              onClick={() => {
                setKind(group.type)
                setSearch("")
              }}
              className={`h-9 flex-1 rounded-md text-sm transition-colors ${kind === group.type ? "bg-background font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {group.name}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="対象を検索"
            placeholder="名前で検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <ul>
          {candidates.map((target) => {
            const key = targetKey(target)
            return (
              <li key={key}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                  <TargetAvatar target={target} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {target.displayName}
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    disabled={!selected.includes(key) && selected.length >= 100}
                    onChange={() => toggle(key)}
                    className="size-4 accent-foreground"
                  />
                </label>
              </li>
            )
          })}
        </ul>
        {!candidates.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            該当する対象はありません
          </p>
        )}
      </div>
    </div>
  )
}

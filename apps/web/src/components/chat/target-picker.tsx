import { matchesMemberFilter } from "./member-filter"
import { targetKey } from "./target-key"
import { useState } from "react"
import { Search, X, SlidersHorizontal } from "lucide-react"
import type { ChatTargetOption } from "@workspace/shared/communications"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@workspace/ui/components/dropdown-menu"
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
  const [kind, setKind] = useState<(typeof kinds)[number]["type"]>("member")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<string[]>([])
  const toggleFilter = (key: string) =>
    setFilters((values) =>
      values.includes(key)
        ? values.filter((value) => value !== key)
        : [...values, key]
    )
  const roleIds = targets
    .filter(
      (target) =>
        target.targetType === "role" && filters.includes(targetKey(target))
    )
    .map((target) => target.targetId)
  const activityIds = targets
    .filter(
      (target) =>
        target.targetType === "activity" && filters.includes(targetKey(target))
    )
    .map((target) => target.targetId)
  const toggle = (key: string) =>
    onChange(
      selected.includes(key)
        ? selected.filter((value) => value !== key)
        : [...selected, key]
    )
  const candidates = targets.filter(
    (target) =>
      target.targetType === kind &&
      (target.targetType !== "member" ||
        matchesMemberFilter(target, roleIds, activityIds)) &&
      target.displayName
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
  )
  return (
    <div className="space-y-5">
      {selected.length > 0 && (
        <ul
          aria-label="選択した対象"
          data-horizontal-scroll
          className="flex max-w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none]"
        >
          {kinds
            .flatMap((group) =>
              targets.filter(
                (target) =>
                  target.targetType === group.type &&
                  selected.includes(targetKey(target))
              )
            )
            .map((target) => (
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
      )}
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
        <div className="flex h-9 items-center gap-2">
          <div className="relative min-w-0 flex-1">
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
          {kind === "member" && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="メンバーを絞り込む"
                    className={`size-9 ${filters.length ? "bg-muted" : ""}`}
                  />
                }
              >
                <SlidersHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-64">
                {kinds
                  .filter(
                    (group) =>
                      group.type === "role" || group.type === "activity"
                  )
                  .map((group) => (
                    <DropdownMenuGroup key={group.type}>
                      <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
                      {targets
                        .filter((target) => target.targetType === group.type)
                        .map((target) => (
                          <DropdownMenuCheckboxItem
                            key={targetKey(target)}
                            checked={filters.includes(targetKey(target))}
                            closeOnClick={false}
                            onCheckedChange={() =>
                              toggleFilter(targetKey(target))
                            }
                          >
                            <span className="truncate">
                              {target.displayName}
                            </span>
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuGroup>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            見つかりませんでした
          </p>
        )}
      </div>
    </div>
  )
}

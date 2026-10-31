import { FilterMenu } from "@workspace/ui/components/filter-menu"
import { emptyFilter, matchesFilter } from "@workspace/ui/lib/filters"
import { targetKey } from "@/features/chat/components/room/target-key"
import * as v from "valibot"
import {
  useViewPreference,
  searchPreferenceSchema,
  filterPreferenceSchema,
} from "@/lib/view-preferences"
import { Search, X } from "lucide-react"
import type { ChatTargetOption } from "@workspace/shared/communications"
import { Input } from "@workspace/ui/components/input"

import { TargetAvatar } from "@/features/chat/components/room/target-avatar"

const kinds = [
  { type: "member", name: "メンバー" },
  { type: "role", name: "ロール" },
  { type: "activity", name: "シフト" },
] as const
const kindSchema = v.picklist(["member", "role", "activity"])

export function TargetPicker({
  viewKey,
  targets,
  optionsReady,
  selected,
  onChange,
}: {
  viewKey: string
  targets: ChatTargetOption[]
  optionsReady: boolean
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [kind, setKind] = useViewPreference(
    `chat-targets:${viewKey}:kind`,
    kindSchema,
    "member"
  )
  const [search, setSearch] = useViewPreference(
    `chat-targets:${viewKey}:search`,
    searchPreferenceSchema,
    ""
  )
  const [roleFilters, setRoleFilters] = useViewPreference(
    `chat-targets:${viewKey}:roles`,
    filterPreferenceSchema,
    emptyFilter()
  )
  const [activityFilters, setActivityFilters] = useViewPreference(
    `chat-targets:${viewKey}:activities`,
    filterPreferenceSchema,
    emptyFilter()
  )
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
        (matchesFilter(target.roleIds, roleFilters) &&
          matchesFilter(target.activityIds, activityFilters))) &&
      target.displayName
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
  )
  return (
    <div className="space-y-5">
      <ul
        aria-label="選択した対象"
        data-horizontal-scroll
        className="flex h-20 max-w-full min-w-0 touch-pan-x [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain py-1"
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
      <div className="space-y-3">
        <fieldset
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
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
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
            <>
              <FilterMenu
                optionsReady={optionsReady}
                label="ロール"
                options={[
                  { value: "unset", label: "未設定" },
                  ...targets
                    .filter((target) => target.targetType === "role")
                    .map((target) => ({
                      value: target.targetId,
                      label: target.displayName,
                    })),
                ]}
                value={roleFilters}
                onChange={setRoleFilters}
              />
              <FilterMenu
                optionsReady={optionsReady}
                label="シフト"
                options={[
                  { value: "unset", label: "未設定" },
                  ...targets
                    .filter((target) => target.targetType === "activity")
                    .map((target) => ({
                      value: target.targetId,
                      label: target.displayName,
                    })),
                ]}
                value={activityFilters}
                onChange={setActivityFilters}
              />
            </>
          )}
        </div>
        <ul>
          {candidates.map((target) => {
            const key = targetKey(target)
            return (
              <li key={key}>
                <label
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 ${selected.includes(key) ? "bg-muted/60" : ""}`}
                >
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

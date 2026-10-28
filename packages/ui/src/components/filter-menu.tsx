import { useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { Check, Filter } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { emptyFilter, type FilterValue } from "@workspace/ui/lib/filters"

type Option = { value: string; label: string }

/** Shared list/table filter: selection survives searching and the popup stays open. */
export function FilterMenu({
  label,
  options,
  value,
  onChange,
  disabled = false,
  iconOnly = false,
  searchable = true,
}: {
  label: string
  options: Option[]
  value: FilterValue
  onChange: (value: FilterValue) => void
  disabled?: boolean
  iconOnly?: boolean
  searchable?: boolean
}) {
  const [search, setSearch] = useState("")
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  )
  const active = value.values.length > 0
  return (
    <Combobox.Root<Option, true>
      multiple
      items={options}
      filteredItems={filtered}
      value={options.filter((option) => value.values.includes(option.value))}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      onValueChange={(selected) =>
        onChange({ ...value, values: selected.map((item) => item.value) })
      }
      inputValue={search}
      onInputValueChange={(next, details) => {
        if (details.reason === "input-clear" && details.isItemPress) return
        setSearch(next)
      }}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "item-press") {
          details.cancel()
          return
        }
        if (!open) setSearch("")
      }}
      disabled={disabled}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={`${label}で絞り込み`}
        title={
          active
            ? `${label}：${value.mode === "exclude" ? "含まない" : "含む"} ${value.values.length}件`
            : `${label}で絞り込み`
        }
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          iconOnly ? "size-7" : "h-9 border bg-background px-3",
          active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
        )}
      >
        <Filter className={cn("size-3.5", active && "fill-current")} />
        {!iconOnly && (
          <span>
            {label}
            {active ? ` (${value.values.length})` : ""}
          </span>
        )}
        {iconOnly && active && (
          <span className="sr-only">{value.values.length}件選択中</span>
        )}
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          className="isolate z-50"
        >
          <Combobox.Popup
            data-slot="filter-popup"
            aria-label={`${label}の絞り込み条件`}
            className="flex max-h-(--available-height) w-64 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
          >
            <div className="space-y-2 border-b p-2">
              {searchable && (
                <Combobox.Input
                  render={<Input />}
                  aria-label={`${label}を検索`}
                  placeholder={`${label}を検索`}
                  className="h-9 text-sm"
                />
              )}
              <fieldset
                aria-label={`${label}の一致条件`}
                className="flex rounded-md bg-muted p-0.5"
              >
                {(["include", "exclude"] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    aria-pressed={value.mode === mode}
                    className={cn(
                      "flex-1 rounded py-1 text-xs",
                      value.mode === mode
                        ? "bg-background font-medium shadow-xs"
                        : "text-muted-foreground"
                    )}
                    onClick={() => onChange({ ...value, mode })}
                  >
                    {mode === "include" ? "含む" : "含まない"}
                  </button>
                ))}
              </fieldset>
            </div>
            {filtered.length === 0 && (
              <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">
                一致する候補がありません。
              </Combobox.Empty>
            )}
            <Combobox.List className="max-h-64 min-h-0 overflow-y-auto p-1">
              {(option: Option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex min-h-9 cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      value.values.includes(option.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    <Combobox.ItemIndicator>
                      <Check className="size-3" />
                    </Combobox.ItemIndicator>
                  </span>
                  <span className="min-w-0 break-words">{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            <div className="flex items-center justify-between border-t px-2 py-1.5 text-xs text-muted-foreground">
              <span>
                {active ? `${value.values.length}件選択中` : "すべて表示"}
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={!active}
                onClick={() => onChange(emptyFilter())}
              >
                解除
              </Button>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

import { useCallback, useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { Check, ChevronDown } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

type Option = { value: string; label: string }

export function SearchableSelect({
  value,
  options,
  onValueChange,
  searchLabel,
  disabled = false,
  size = "lg",
  className,
  ...props
}: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  searchLabel: string
  disabled?: boolean
  size?: "default" | "md" | "lg"
  className?: string
  id?: string
  "aria-label"?: string
}) {
  const [search, setSearch] = useState("")
  const [container, setContainer] = useState<HTMLDialogElement | null>(null)
  const triggerRef = useCallback((element: HTMLButtonElement | null) => {
    setContainer(element?.closest("dialog") ?? null)
  }, [])
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  )
  return (
    <Combobox.Root<Option>
      items={options}
      filteredItems={filtered}
      value={options.find((option) => option.value === value) ?? null}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      inputValue={search}
      onInputValueChange={setSearch}
      onOpenChange={() => setSearch("")}
      onValueChange={(option) => {
        if (option !== null) onValueChange(option.value)
      }}
      disabled={disabled}
      autoHighlight
    >
      <Combobox.Trigger
        {...props}
        ref={triggerRef}
        data-size={size}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=lg]:h-11 data-[size=md]:h-10",
          className
        )}
      >
        <span className="truncate text-left">
          <Combobox.Value />
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </Combobox.Trigger>
      <Combobox.Portal container={container ?? undefined}>
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          positionMethod={container ? "fixed" : "absolute"}
          className="isolate z-50"
        >
          <Combobox.Popup className="flex max-h-(--available-height) w-(--anchor-width) min-w-44 flex-col overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <div className="p-2">
              <Combobox.Input
                render={<Input />}
                aria-label={searchLabel}
                placeholder={searchLabel}
              />
            </div>
            <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">
              一致する候補がありません。
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto p-1">
              {(option: Option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="relative flex min-h-11 cursor-default items-center rounded-sm py-2 pr-8 pl-2 text-base outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {option.label}
                  <Combobox.ItemIndicator className="absolute right-2">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

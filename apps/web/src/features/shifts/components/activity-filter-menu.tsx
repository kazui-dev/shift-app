import { useState } from "react"
import { Input } from "@workspace/ui/components/input"
import { ChevronDown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
export function ActivityFilterMenu({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  )
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setSearch("")
      }}
    >
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        {label}
        {value.length > 0 && ` (${value.length})`}
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 min-w-44">
        <div className="sticky top-0 z-10 bg-popover p-1 pb-2">
          <Input
            aria-label={`${label}を検索`}
            placeholder={`${label}を検索`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Escape" &&
                event.key !== "Tab" &&
                event.key !== "ArrowDown" &&
                event.key !== "ArrowUp"
              )
                event.stopPropagation()
            }}
          />
        </div>
        <DropdownMenuItem onClick={() => onChange([])}>すべて</DropdownMenuItem>
        <DropdownMenuSeparator />
        {filtered.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value.includes(option.value)}
            closeOnClick={false}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...value, option.value]
                  : value.filter((item) => item !== option.value)
              )
            }
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {!filtered.length && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            一致する候補がありません。
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

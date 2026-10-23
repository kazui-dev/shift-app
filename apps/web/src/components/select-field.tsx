import { useCallback, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { SearchableSelect } from "@workspace/ui/components/searchable-select"

export function SelectField({
  value,
  options,
  onValueChange,
  disabled,
  className,
  size = "lg",
  searchable = false,
  ...props
}: {
  value: string | number
  options: readonly { value: string | number; label: string }[]
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  "aria-label"?: string
  size?: "default" | "md" | "lg"
  className?: string
  searchable?: boolean
}) {
  const [container, setContainer] = useState<HTMLDialogElement | null>(null)
  const triggerRef = useCallback((element: HTMLButtonElement | null) => {
    setContainer(element?.closest("dialog") ?? null)
  }, [])
  const items = options.map((option) => ({
    value: String(option.value),
    label: option.label,
  }))
  if (searchable)
    return (
      <SearchableSelect
        {...props}
        value={String(value)}
        options={items}
        onValueChange={onValueChange}
        searchLabel={`${props["aria-label"] ?? "候補"}を検索`}
        disabled={disabled ?? false}
        size={size}
        className={cn(className)}
      />
    )
  return (
    <Select
      value={String(value)}
      items={items}
      disabled={disabled ?? false}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next)
      }}
    >
      <SelectTrigger
        ref={triggerRef}
        {...props}
        size={size}
        className={cn(
          "w-full min-w-0 rounded-lg bg-background px-3 text-base",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        container={container ?? undefined}
        alignItemWithTrigger={false}
        align="start"
      >
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="min-h-11 text-base"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

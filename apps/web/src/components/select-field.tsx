import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

export function SelectField({
  value,
  options,
  onValueChange,
  disabled,
  className,
  ...props
}: {
  value: string | number
  options: readonly { value: string | number; label: string }[]
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  "aria-label"?: string
  className?: string
}) {
  const items = options.map((option) => ({
    value: String(option.value),
    label: option.label,
  }))
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
        {...props}
        className={cn(
          "h-11 w-full min-w-0 rounded-lg bg-background px-3 text-base",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
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

import { useCallback, useState } from "react"
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
  size = "lg",
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
}) {
  const [container, setContainer] = useState<HTMLDialogElement | null>(null)
  const triggerRef = useCallback((element: HTMLButtonElement | null) => {
    setContainer(element?.closest("dialog") ?? null)
  }, [])
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
        container={container}
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

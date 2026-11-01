import { Button } from "./button"

export function ViewSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  options: readonly { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="flex shrink-0 gap-2" aria-label={label}>
      {options.map((item) => (
        <Button
          key={item.id}
          variant={value === item.id ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={value === item.id}
          disabled={disabled}
          onClick={() => {
            if (value !== item.id) onChange(item.id)
          }}
        >
          {item.label}
        </Button>
      ))}
    </fieldset>
  )
}

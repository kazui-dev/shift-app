import { Input } from "@workspace/ui/components/input"

export function ChatNameField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2.5">
      <label htmlFor={id} className="block text-sm font-medium">
        チャット名
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        maxLength={120}
        autoComplete="off"
      />
    </div>
  )
}

import { useState } from "react"
import { Input } from "@workspace/ui/components/input"
function format(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}
export function MinuteInput({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (value: number) => void
  label: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? format(value)}
      maxLength={5}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        if (/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(text)) {
          const [hour = "0", minute = "0"] = text.split(":")
          onChange(Number(hour) * 60 + Number(minute))
        }
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

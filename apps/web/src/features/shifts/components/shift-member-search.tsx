import { useId } from "react"
import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"

export function ShiftMemberSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className="relative min-w-0 flex-1 basis-full sm:max-w-56 sm:basis-auto"
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
      />
      <Input
        id={id}
        className="pl-9"
        aria-label="名前・学籍番号で検索"
        placeholder="名前・学籍番号で検索"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

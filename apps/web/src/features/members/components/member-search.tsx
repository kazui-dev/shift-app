import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"

export function MemberSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative w-full max-w-56 min-w-0">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        className="h-7 min-w-0 pl-8 text-xs shadow-none md:text-xs"
        aria-label="名前・学籍番号で検索"
        placeholder="名前・学籍番号で検索"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

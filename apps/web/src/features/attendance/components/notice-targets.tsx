import { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"

export function NoticeTargets({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; name: string; detail?: string }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const filtered = options.filter((option) =>
    `${option.name} ${option.detail ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )
  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id]
    )
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-medium">
        {label}
        <span className="ml-2 text-muted-foreground">{value.length}件選択</span>
      </legend>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={`選択した${label}`}>
          {options
            .filter((option) => value.includes(option.id))
            .map((option) => (
              <span
                key={option.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted py-1 pr-1 pl-2 text-sm"
              >
                <span className="truncate">{option.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  aria-label={`${option.name}の選択を解除`}
                  onClick={() => toggle(option.id)}
                >
                  <X className="size-3.5" />
                </Button>
              </span>
            ))}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border">
        <div className="relative border-b p-2">
          <Search
            aria-hidden
            className="absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-9"
            type="search"
            aria-label={`${label}を検索`}
            placeholder={`${label}を検索`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <ul className="max-h-64 divide-y overflow-y-auto">
          {filtered.map((option) => (
            <li key={option.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={value.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {option.name}
                </span>
                {option.detail && (
                  <span className="text-xs text-muted-foreground">
                    {option.detail}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            一致する候補がありません
          </p>
        )}
      </div>
    </fieldset>
  )
}

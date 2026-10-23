import { useState, type ReactNode } from "react"
import { Input } from "@workspace/ui/components/input"

export function SearchableList<Item>({
  label,
  items,
  getSearchText,
  children,
}: {
  label: string
  items: readonly Item[]
  getSearchText: (item: Item) => string
  children: (item: Item) => ReactNode
}) {
  const [search, setSearch] = useState("")
  const filtered = items.filter((item) =>
    getSearchText(item)
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )
  return (
    <div className="space-y-2">
      <Input
        type="search"
        aria-label={`${label}を検索`}
        placeholder={`${label}を検索`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
      />
      <div className="max-h-60 overflow-y-auto">
        {filtered.map(children)}
        {!filtered.length && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            一致する候補がありません。
          </p>
        )}
      </div>
    </div>
  )
}

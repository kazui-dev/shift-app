export function MemberLabels({
  items,
}: {
  items: readonly { id: string; name: string }[]
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.length ? (
        items.map((item) => (
          <span
            key={item.id}
            className="inline-flex max-w-full rounded-md border bg-muted/40 px-2 py-0.5 text-xs leading-5 break-words"
          >
            {item.name}
          </span>
        ))
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function LoadingState() {
  return <p className="text-sm text-muted-foreground">読み込み中…</p>
}

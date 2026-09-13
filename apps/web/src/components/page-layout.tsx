import { cn } from "@workspace/ui/lib/utils"

export function PageHeader({
  title,
  back,
  children,
  className,
}: {
  title: string
  back?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex min-h-11 items-center gap-2", className)}>
      {back}
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
        {title}
      </h1>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </header>
  )
}

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

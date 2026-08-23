import { cn } from "@workspace/ui/lib/utils"

export function PageBreadcrumb({ children }: { children: React.ReactNode }) {
  return (
    <nav className="flex min-h-9 items-center" aria-label="パンくず">
      {children}
    </nav>
  )
}

export function PageHeader({
  title,
  children,
  className,
}: {
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex min-h-10 flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children}
    </header>
  )
}

export function SectionHeader({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

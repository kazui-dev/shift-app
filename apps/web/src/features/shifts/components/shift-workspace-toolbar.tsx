import type { ReactNode } from "react"

/** Work controls precede the shared sticky time axis inside the viewport. */
export function ShiftWorkspaceToolbar({
  label,
  children,
  leading,
  actions,
  selection,
}: {
  label: string
  children?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
  selection?: ReactNode
}) {
  return (
    <section aria-label={label} className="bg-background">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {leading}
        {children && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {children}
          </div>
        )}
        {actions && (
          <div className="ml-auto flex flex-wrap items-center gap-1 sm:gap-2">
            {actions}
          </div>
        )}
        {selection && (
          <div className="basis-full empty:hidden">{selection}</div>
        )}
      </div>
    </section>
  )
}

import type { ReactNode } from "react"

export function ShiftViewToolbar({
  navigation,
  children,
}: {
  navigation: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b py-3">
      {navigation}
      {children && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

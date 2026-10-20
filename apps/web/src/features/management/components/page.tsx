import { useState, type ComponentProps, type ReactNode } from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { ManagementHeaderActionsContext } from "../header-actions-context"

export function ManagementPage({
  header,
  children,
  ...props
}: Omit<ComponentProps<"section">, "className"> & { header: ReactNode }) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <ManagementHeaderActionsContext value={actions}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col" {...props}>
        <PageHeader className="sm:px-6">
          {header}
          <div
            ref={setActions}
            className="flex shrink-0 items-center gap-2 empty:hidden"
          />
        </PageHeader>
        {children}
      </section>
    </ManagementHeaderActionsContext>
  )
}

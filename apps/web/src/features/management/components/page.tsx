import { Menu } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ManagementNavigationContext } from "../navigation-context"
import {
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { ManagementHeaderActionsContext } from "../header-actions-context"

export function ManagementPage({
  header,
  children,
  ...props
}: Omit<ComponentProps<"section">, "className"> & { header: ReactNode }) {
  const openMenu = useContext(ManagementNavigationContext)
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <ManagementHeaderActionsContext value={actions}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col" {...props}>
        <PageHeader className="h-auto min-h-15 flex-wrap gap-y-2 py-2 sm:px-6">
          {openMenu && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="管理メニューを開く"
              onClick={openMenu}
            >
              <Menu />
            </Button>
          )}
          {header}
          <div
            ref={setActions}
            className="flex flex-wrap items-center gap-2 empty:hidden"
          />
        </PageHeader>
        {children}
      </section>
    </ManagementHeaderActionsContext>
  )
}

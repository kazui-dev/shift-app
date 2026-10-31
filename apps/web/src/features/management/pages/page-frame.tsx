import { ManagementHeaderLeadingContext } from "../header-actions-context"
import { NavigationGuard } from "@/components/navigation-guard"
import { useState, type ReactNode } from "react"
import { ManagementViewport } from "../components/viewport"
import { ManagementPage } from "../components/page"
import { useManagement } from "../management-context"

export function ManagementPageFrame({
  title,
  titleInNavigation = false,
  viewKey,
  headerLeading,
  headerTrailing,
  headerActions,
  scrollable = true,
  contentWidth = "contained",
  pending = false,
  allowNavigation,
  dirty: screenDirty,
  children,
}: {
  title: string
  titleInNavigation?: boolean
  viewKey: string
  headerLeading?: ReactNode
  headerTrailing?: ReactNode
  headerActions?: ReactNode
  scrollable?: boolean
  contentWidth?: "contained" | "full"
  allowNavigation?: () => boolean
  pending?: boolean
  dirty?: boolean
  children: ReactNode
}) {
  const { dirty } = useManagement()
  const [leading, setLeading] = useState<HTMLDivElement | null>(null)

  return (
    <ManagementHeaderLeadingContext value={leading}>
      <ManagementPage
        header={
          <>
            {headerLeading}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <h2
                className={
                  titleInNavigation
                    ? "shrink-0 text-base font-medium whitespace-nowrap md:sr-only"
                    : "shrink-0 text-base font-medium whitespace-nowrap"
                }
              >
                {title}
              </h2>
              <div
                ref={setLeading}
                className="flex flex-wrap items-center gap-2 empty:hidden"
              />
              {headerTrailing}
            </div>
            {headerActions}
          </>
        }
      >
        {scrollable ? (
          <ManagementViewport viewKey={viewKey} width={contentWidth}>
            {children}
          </ManagementViewport>
        ) : (
          children
        )}
        <NavigationGuard
          dirty={screenDirty ?? dirty}
          pending={pending}
          {...(allowNavigation ? { allowNavigation } : {})}
        />
      </ManagementPage>
    </ManagementHeaderLeadingContext>
  )
}

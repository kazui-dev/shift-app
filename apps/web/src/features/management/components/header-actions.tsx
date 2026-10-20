import { useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ManagementHeaderActionsContext } from "../header-actions-context"

/** Keep page-owned actions beside the page title, outside page scrolling. */
export function ManagementHeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(ManagementHeaderActionsContext)
  return target ? createPortal(children, target) : null
}

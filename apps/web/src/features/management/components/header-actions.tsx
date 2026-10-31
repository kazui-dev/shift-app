import { useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  ManagementHeaderActionsContext,
  ManagementHeaderLeadingContext,
} from "../header-actions-context"

export function ManagementHeaderActions({
  children,
  placement = "end",
}: {
  children: ReactNode
  placement?: "start" | "end"
}) {
  const end = useContext(ManagementHeaderActionsContext)
  const start = useContext(ManagementHeaderLeadingContext)
  const target = placement === "start" ? start : end
  return target ? createPortal(children, target) : null
}

import { createContext } from "react"

/** The workspace owns navigation; each page supplies its mobile entry point. */
export const ManagementNavigationContext = createContext<(() => void) | null>(
  null
)

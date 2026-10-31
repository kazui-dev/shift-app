import { useState, type ReactNode } from "react"
import {
  createViewPreferences,
  ViewPreferencesContext,
} from "@/lib/view-preferences"

export function ViewPreferencesProvider({
  user,
  children,
}: {
  user: string
  children: ReactNode
}) {
  const [store] = useState(() => createViewPreferences(user))
  return (
    <ViewPreferencesContext value={store}>{children}</ViewPreferencesContext>
  )
}

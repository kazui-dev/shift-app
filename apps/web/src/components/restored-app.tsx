import type { ReactNode } from "react"
import { useIsRestoring } from "@tanstack/react-query"

export function RestoredApp({ children }: { children: ReactNode }) {
  const restoring = useIsRestoring()
  return restoring ? null : children
}

import { createContext, useContext } from "react"

export const OfflineModeContext = createContext(false)

export function useOfflineMode(): boolean {
  return useContext(OfflineModeContext)
}

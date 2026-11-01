import { useState } from "react"

const storageKey = "shift-app:overview-attendance-colors"

export function useAttendanceColors() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true"
    } catch {
      return false
    }
  })

  function toggle() {
    const next = !enabled
    setEnabled(next)
    try {
      localStorage.setItem(storageKey, String(next))
    } catch {
      // Keep the control usable when browser storage is unavailable.
    }
  }

  return { enabled, toggle }
}

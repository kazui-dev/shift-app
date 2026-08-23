import { Toaster } from "@workspace/ui/components/sonner"

import { useTheme } from "@/components/theme-context"

export function AppToaster() {
  const { theme } = useTheme()

  return (
    <Toaster
      theme={theme}
      position="top-center"
      mobileOffset={{ top: "calc(1rem + env(safe-area-inset-top))" }}
    />
  )
}

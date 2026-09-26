import { useRouter } from "@tanstack/react-router"

declare module "@tanstack/react-router" {
  interface HistoryState {
    managementParent?: string
  }
}

export function useManagementBack(fallback: "/manage" | "/manage/shifts") {
  const router = useRouter()
  return () => {
    if (router.history.location.state.managementParent) router.history.back()
    else void router.navigate({ to: fallback, replace: true })
  }
}

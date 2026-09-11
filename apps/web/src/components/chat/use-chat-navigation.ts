import { useLayoutEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "@tanstack/react-router"
import { ChatNavigation } from "./navigation"

declare module "@tanstack/react-router" {
  interface HistoryState {
    chatFromList?: boolean
  }
}

export function useChatNavigation() {
  const router = useRouter()
  const [navigation] = useState(
    () =>
      new ChatNavigation(
        /^\/chat\/([^/]+)$/.exec(router.history.location.pathname)?.[1],
        {
          canGoBack: () => !!router.history.location.state.chatFromList,
          back: () => router.history.back(),
          open: (roomId, options) => {
            void router.navigate({
              to: "/chat/$roomId",
              params: { roomId },
              state: { chatFromList: options.fromList },
              replace: options.replace,
            })
          },
          list: () => {
            void router.navigate({ to: "/chat", replace: true })
          },
        }
      )
  )
  useLayoutEffect(() => {
    const unsubscribe = router.history.subscribe(({ location, action }) => {
      navigation.receive(
        /^\/chat\/([^/]+)$/.exec(location.pathname)?.[1],
        action.type === "BACK" ? "back" : "navigate"
      )
    })
    navigation.receive(
      /^\/chat\/([^/]+)$/.exec(router.history.location.pathname)?.[1]
    )
    return unsubscribe
  }, [router, navigation])
  const view = useSyncExternalStore(navigation.subscribe, navigation.snapshot)
  return {
    ...view,
    open: navigation.open,
    back: navigation.back,
    resume: navigation.resume,
  }
}

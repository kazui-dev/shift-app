import { chatRoomId } from "@/lib/chat-location"
import { useLayoutEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "@tanstack/react-router"
import { ChatNavigation } from "./navigation"

declare module "@tanstack/react-router" {
  interface HistoryState {
    chatList?: boolean
    chatRemoved?: string
    chatFromList?: boolean
    chatCreate?: boolean
    chatSettings?: boolean
  }
}

export function useChatNavigation() {
  const router = useRouter()
  const [navigation] = useState(
    () =>
      new ChatNavigation(chatRoomId(router.history.location.pathname), {
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
          void router.navigate({
            to: "/chat",
            replace: true,
            state: { chatList: true },
          })
        },
      })
  )
  useLayoutEffect(() => {
    const unsubscribe = router.history.subscribe(({ location, action }) => {
      if (
        location.pathname !== "/chat" &&
        !location.pathname.startsWith("/chat/")
      )
        return
      navigation.receive(
        chatRoomId(location.pathname),
        action.type === "BACK" ? "back" : "navigate"
      )
      if (location.state.chatRemoved)
        navigation.remove(location.state.chatRemoved)
    })
    navigation.receive(chatRoomId(router.history.location.pathname))
    return unsubscribe
  }, [router, navigation])
  const view = useSyncExternalStore(navigation.subscribe, navigation.snapshot)
  return {
    ...view,
    open: navigation.open,
    back: navigation.back,
    resume: navigation.resume,
    remove: navigation.remove,
  }
}

import { toast } from "@workspace/ui/lib/toast"
import { errorMessage } from "@/api/client"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { subscribeChatEvents } from "@/api/chat-events"
import { applyChatEvent } from "@/data/chat-events"
import { useChatStore } from "@/components/chat/use-chat-store"
import { useOfflineMode } from "@/components/offline-mode-context"

export function useChatEvents() {
  const client = useQueryClient(),
    offline = useOfflineMode()
  const { member, store } = useChatStore()
  const router = useRouter()
  useEffect(() => {
    if (offline) return undefined
    return subscribeChatEvents((event) => {
      if (event?.type === "room_removed") {
        const id = event.roomId
        void store
          .removeRoom(id)
          .catch((error: unknown) => toast.error(errorMessage(error)))
        const path = router.state.location.pathname
        if (
          path === "/chat" ||
          path === `/chat/${id}` ||
          path.startsWith(`/chat/${id}/`)
        )
          void router.navigate({
            to: "/chat",
            replace: true,
            state: { chatList: true, chatRemoved: id },
          })
      }
      applyChatEvent(client, event, member.id)
    })
  }, [client, offline, member.id, router, store])
}

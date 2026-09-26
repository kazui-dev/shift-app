import { toast } from "@workspace/ui/lib/toast"
import { errorMessage } from "@/lib/http/client"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { subscribeLiveEvents } from "@/app/api/live-events"
import { applyLiveEvent } from "@/app/data/live-events"
import { useChatStore } from "@/features/chat/hooks/use-chat-store"
import { useOfflineMode } from "@/app/offline-mode-context"

/** Keeps chat and every other shared view current while the app is open. */
export function LiveEvents() {
  const client = useQueryClient(),
    offline = useOfflineMode()
  const { member, store } = useChatStore()
  const router = useRouter()
  useEffect(() => {
    if (offline) return undefined
    return subscribeLiveEvents((event) => {
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
      applyLiveEvent(client, event, member.id)
    })
  }, [client, offline, member.id, router, store])
  return null
}

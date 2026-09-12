import { chatRoomId } from "@/lib/chat-location"
import { useRouter } from "@tanstack/react-router"
import { useChatEvents } from "./use-chat-events"
import { useEffect } from "react"
import { receiveMessage } from "@/data/chat-cache"
import { useQueryClient } from "@tanstack/react-query"
import { useChatStore } from "./use-chat-store"
import { useOfflineMode } from "../offline-mode-context"

export function ChatDelivery() {
  useChatEvents()
  const router = useRouter()
  const { store, ready, queue } = useChatStore(),
    client = useQueryClient(),
    offline = useOfflineMode()
  useEffect(() => {
    if (!offline && ready)
      void store.flush((roomId, message) => {
        if (
          !receiveMessage(
            client,
            roomId,
            message,
            chatRoomId(router.history.location.pathname) === roomId &&
              document.visibilityState === "visible"
          )
        )
          void client.invalidateQueries({ queryKey: ["chat-messages", roomId] })
      })
  }, [store, client, offline, ready, queue, router])
  return null
}

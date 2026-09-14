import { keys } from "@/data/keys"
import { useChatEvents } from "@/components/chat/use-chat-events"
import { useEffect } from "react"
import { receiveMessage } from "@/data/chat-cache"
import { useQueryClient } from "@tanstack/react-query"
import { useChatStore } from "@/components/chat/use-chat-store"
import { useOfflineMode } from "@/components/offline-mode-context"

export function ChatDelivery() {
  useChatEvents()
  const { store, member, ready, queue } = useChatStore(),
    client = useQueryClient(),
    offline = useOfflineMode()
  useEffect(() => {
    if (!offline && ready)
      void store.flush((roomId, message) => {
        if (!receiveMessage(client, roomId, message, member.id))
          void client.invalidateQueries({ queryKey: keys.chatMessages(roomId) })
      })
  }, [store, client, offline, ready, queue, member.id])
  return null
}

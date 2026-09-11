import { useEffect } from "react"
import { receiveMessage } from "@/data/chat-cache"
import { useQueryClient } from "@tanstack/react-query"
import { useChatStore } from "./use-chat-store"
import { useOfflineMode } from "../offline-mode-context"

export function ChatDelivery() {
  const { store, ready, queue } = useChatStore(),
    client = useQueryClient(),
    offline = useOfflineMode()
  useEffect(() => {
    if (!offline && ready)
      void store.flush((roomId, message) => {
        if (!receiveMessage(client, roomId, message))
          void client.invalidateQueries({ queryKey: ["chat-messages", roomId] })
      })
  }, [store, client, offline, ready, queue])
  return null
}

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useChatStore } from "./use-chat-store"
import { useOfflineMode } from "../offline-mode-context"

export function ChatDelivery() {
  const { store, ready, queue } = useChatStore(),
    client = useQueryClient(),
    offline = useOfflineMode()
  useEffect(() => {
    if (!offline && ready)
      void store.flush((roomId) => {
        void client.invalidateQueries({ queryKey: ["chat-messages", roomId] })
        void client.invalidateQueries({ queryKey: ["chat-rooms"] })
        void client.invalidateQueries({ queryKey: ["chat-room", roomId] })
      })
  }, [store, client, offline, ready, queue])
  return null
}

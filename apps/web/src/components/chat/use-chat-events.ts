import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { subscribeChatEvents } from "@/api/chat-events"
import { useOfflineMode } from "../offline-mode-context"

export function useChatEvents() {
  const client = useQueryClient(),
    offline = useOfflineMode()
  useEffect(() => {
    if (offline) return undefined
    return subscribeChatEvents(
      () => void client.invalidateQueries({ queryKey: ["chat-rooms"] })
    )
  }, [client, offline])
}

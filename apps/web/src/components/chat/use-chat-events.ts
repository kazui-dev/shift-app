import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { subscribeChatEvents } from "@/api/chat-events"
import { applyChatEvent } from "@/data/chat-events"
import { useChatStore } from "./use-chat-store"
import { useOfflineMode } from "../offline-mode-context"

export function useChatEvents() {
  const client = useQueryClient(),
    offline = useOfflineMode()
  const { member } = useChatStore()
  useEffect(() => {
    if (offline) return undefined
    return subscribeChatEvents((event) =>
      applyChatEvent(client, event, member.id)
    )
  }, [client, offline, member.id])
}

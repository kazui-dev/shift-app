import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { subscribeChatEvents } from "@/api/chat-events"
import { applyChatEvent } from "@/data/chat-events"
import { chatRoomId } from "@/lib/chat-location"
import { useChatStore } from "./use-chat-store"
import { useOfflineMode } from "../offline-mode-context"

export function useChatEvents() {
  const client = useQueryClient(),
    offline = useOfflineMode(),
    router = useRouter()
  const { member } = useChatStore()
  useEffect(() => {
    if (offline) return undefined
    return subscribeChatEvents((event) =>
      applyChatEvent(
        client,
        event,
        member.id,
        document.visibilityState === "visible"
          ? (chatRoomId(router.history.location.pathname) ?? null)
          : null
      )
    )
  }, [client, offline, member.id, router])
}

import { keys } from "@/app/data/keys"
import { useEffect } from "react"
import { receiveMessage } from "@/features/chat/data/chat-cache"
import { useQueryClient } from "@tanstack/react-query"
import { useChatStore } from "@/features/chat/hooks/use-chat-store"
import { useOfflineMode } from "@/app/offline-mode-context"

export function ChatDelivery() {
  const { store, member, ready, queue, drafts, originals } = useChatStore(),
    client = useQueryClient(),
    offline = useOfflineMode()
  useEffect(() => {
    const pending =
      queue.length > 0 ||
      originals.length > 0 ||
      Object.values(drafts).some((draft) => draft.files.length > 0)
    if (!offline && ready && pending)
      void store.flush((roomId, message) => {
        if (!receiveMessage(client, roomId, message, member.id))
          void client.invalidateQueries({ queryKey: keys.chatMessages(roomId) })
      })
  }, [store, client, offline, ready, queue, drafts, originals, member.id])
  return null
}

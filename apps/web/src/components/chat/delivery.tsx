import { useEffect } from "react"
import type { InfiniteData } from "@tanstack/react-query"
import type { getChatMessages } from "@/api/chat"
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
        client.setQueryData<
          InfiniteData<
            Awaited<ReturnType<typeof getChatMessages>>,
            number | null
          >
        >(["chat-messages", roomId], (current) => {
          if (!current)
            return {
              pages: [{ messages: [message], hasMore: false }],
              pageParams: [null],
            }
          if (
            current.pages.some((page) =>
              page.messages.some((item) => item.id === message.id)
            )
          )
            return current
          return {
            ...current,
            pages: current.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    messages: [...page.messages, message].sort(
                      (a, b) => a.sequence - b.sequence
                    ),
                  }
                : page
            ),
          }
        })
        void client.invalidateQueries({ queryKey: ["chat-messages", roomId] })
        void client.invalidateQueries({ queryKey: ["chat-rooms"] })
        void client.invalidateQueries({ queryKey: ["chat-room", roomId] })
      })
  }, [store, client, offline, ready, queue])
  return null
}

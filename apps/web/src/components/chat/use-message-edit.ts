import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { editChatMessage } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { receiveMessage } from "@/data/chat-cache"
import { toast } from "@workspace/ui/lib/toast"
import type { MessageRow } from "./message-list"

export function useMessageEdit(roomId: string) {
  const client = useQueryClient()
  const [editing, setEditing] = useState<{
    id: string
    content: string
    original: string
    hasImages: boolean
  } | null>(null)
  const [pending, setPending] = useState(false)
  const saving = useRef(false)
  function cancel() {
    if (!saving.current) setEditing(null)
  }
  async function save(content: string) {
    if (!editing || saving.current || (!content.trim() && !editing.hasImages))
      return
    if (content.trim() === editing.original) {
      cancel()
      return
    }
    saving.current = true
    setPending(true)
    try {
      const result = await editChatMessage(roomId, editing.id, content)
      receiveMessage(client, roomId, result.message)
      setEditing(null)
      void client.invalidateQueries({ queryKey: ["chat-messages", roomId] })
      void client.invalidateQueries({
        queryKey: ["chat-image-message", roomId],
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      saving.current = false
      setPending(false)
    }
  }
  return {
    editing,
    pending,
    cancel,
    save,
    start: (message: MessageRow) => {
      if (!saving.current)
        setEditing({
          id: message.id,
          content: message.content,
          original: message.content,
          hasImages: message.attachments.length > 0,
        })
    },
    change: (content: string) =>
      setEditing((current) => (current ? { ...current, content } : null)),
  }
}

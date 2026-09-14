import { useRef } from "react"
import { keys } from "@/data/keys"
import { useQueryClient } from "@tanstack/react-query"
import { deleteChatMessage } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { optimisticallyDeleteMessage, receiveMessage } from "@/data/chat-cache"
import { toast } from "@workspace/ui/lib/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"

export function DeleteMessageDialog({
  roomId,
  messageId,
  onClosed,
  onConfirm,
}: {
  roomId: string
  messageId: string
  onClosed: () => void
  onConfirm: () => void
}) {
  const client = useQueryClient()
  const pending = useRef(false)
  async function remove() {
    if (pending.current) return
    pending.current = true
    await client.cancelQueries({ queryKey: keys.chatMessages(roomId) })
    const rollback = optimisticallyDeleteMessage(client, roomId, messageId)
    try {
      const { message } = await deleteChatMessage(roomId, messageId)
      receiveMessage(client, roomId, message)
      await client.invalidateQueries({
        queryKey: keys.chatImageMessage(roomId),
      })
    } catch (error) {
      rollback()
      toast.error(errorMessage(error))
    }
  }
  return (
    <ConfirmDialog
      title="メッセージを削除しますか"
      confirmLabel="削除"
      onCancel={onClosed}
      onClosed={onClosed}
      onConfirm={() => {
        onConfirm()
        void remove()
      }}
    />
  )
}

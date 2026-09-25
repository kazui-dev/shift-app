import { useRef } from "react"
import { keys } from "@/app/data/keys"
import { useQueryClient } from "@tanstack/react-query"
import { deleteChatMessage } from "@/features/chat/api/chat"
import { errorMessage } from "@/lib/http/client"
import {
  optimisticallyDeleteMessage,
  receiveMessage,
} from "@/features/chat/data/chat-cache"
import { useChatMember } from "@/features/chat/components/use-chat-member"
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
  const member = useChatMember()
  const pending = useRef(false)
  async function remove() {
    if (pending.current) return
    pending.current = true
    await client.cancelQueries({ queryKey: keys.chatMessages(roomId) })
    const rollback = optimisticallyDeleteMessage(client, roomId, messageId)
    try {
      const { message } = await deleteChatMessage(roomId, messageId)
      receiveMessage(client, roomId, message, member.id)
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

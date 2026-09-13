import { useEffect, useRef } from "react"
import { CornerUpLeft, Pencil, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { messagePermissions } from "@workspace/shared/messages"
import type { ChatRoom } from "@/api/chat"
import type { MessageRow } from "./message-list"

export function MessageActionDrawer({
  message,
  room,
  memberId,
  open,
  disabled,
  onOpenChange,
  onClosed,
  onReply,
  onEdit,
  onDelete,
}: {
  message: MessageRow | null
  room: ChatRoom
  memberId: string
  open: boolean
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onClosed: () => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const openingGesture = useRef(true)
  useEffect(() => {
    if (!open) return undefined
    openingGesture.current = true
    const started = () => {
      openingGesture.current = false
    }
    document.addEventListener("pointerdown", started, true)
    return () => document.removeEventListener("pointerdown", started, true)
  }, [open])
  const permission =
    message &&
    messagePermissions({
      memberId,
      authorId: message.memberId,
      canPost: room.canPost,
      canManage: room.canManage,
      deleted: !!message.deleted,
    })
  return (
    <Drawer
      open={open}
      onOpenChange={(next, details) => {
        if (
          !next &&
          openingGesture.current &&
          details.reason === "outside-press"
        ) {
          details.cancel()
          return
        }
        onOpenChange(next)
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed()
      }}
    >
      <DrawerContent
        finalFocus={false}
        className="pb-[env(safe-area-inset-bottom)]"
      >
        <DrawerTitle className="sr-only">メッセージの操作</DrawerTitle>
        <div className="flex flex-col gap-1 p-3">
          {permission?.reply && (
            <DrawerClose
              disabled={disabled}
              render={<Button variant="ghost" className="h-12 justify-start" />}
              onClick={onReply}
            >
              <CornerUpLeft />
              返信
            </DrawerClose>
          )}
          {permission?.edit && (
            <DrawerClose
              disabled={disabled}
              render={<Button variant="ghost" className="h-12 justify-start" />}
              onClick={onEdit}
            >
              <Pencil />
              編集
            </DrawerClose>
          )}
          {permission?.delete && (
            <DrawerClose
              disabled={disabled}
              replace
              render={
                <Button
                  variant="ghost"
                  className="h-12 justify-start text-destructive"
                />
              }
              onClick={onDelete}
            >
              <Trash2 />
              削除
            </DrawerClose>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

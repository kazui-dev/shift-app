import { useState } from "react"
import { getRouteApi, useRouter } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { toast } from "@workspace/ui/lib/toast"
import { deleteChatRoom, getChatRoom, leaveChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { removeRoom } from "@/data/chat-cache"
import { RoomSettings } from "@/components/chat/room-settings"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useChatStore } from "@/components/chat/use-chat-store"
import { RoutePage } from "@/components/route-page"

export function RoomSettingsPage() {
  const { roomId } = getRouteApi("/_app/chat/$roomId/settings").useParams()
  return <RoomSettingsScreen key={roomId} roomId={roomId} />
}
function RoomSettingsScreen({ roomId }: { roomId: string }) {
  const router = useRouter(),
    client = useQueryClient()
  const { store, queue } = useChatStore()
  const [action, setAction] = useState<"leave" | "delete">()
  const [pending, setPending] = useState(false)
  const close = () => {
    if (router.history.location.state.chatSettings) router.history.back()
    else
      void router.navigate({
        to: "/chat/$roomId",
        params: { roomId },
        replace: true,
      })
  }
  const query = useQuery({
    queryKey: ["chat-room", roomId],
    queryFn: () => getChatRoom(roomId),
  })
  const room = query.data?.room
  async function confirm() {
    if (!action || pending) return
    setPending(true)
    try {
      if (action === "delete") {
        await deleteChatRoom(roomId)
        for (const queued of queue.filter((item) => item.roomId === roomId))
          store.cancel(queued.id)
        store.edit(roomId, { content: "", files: [] })
        removeRoom(client, roomId)
      } else {
        await leaveChatRoom(roomId)
        await Promise.all([
          client.invalidateQueries({ queryKey: ["chat-rooms"] }),
          client.invalidateQueries({ queryKey: ["chat-room", roomId] }),
          client.invalidateQueries({ queryKey: ["chat-members", roomId] }),
        ])
      }
      await router.navigate({ to: "/chat", replace: true })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
      setAction(undefined)
    }
  }
  return (
    <RoutePage onClose={close}>
      {room ? (
        <RoomSettings
          key={roomId}
          room={room}
          onClose={close}
          onLeave={() => setAction("leave")}
          onDelete={() => setAction("delete")}
        />
      ) : (
        <>
          <ResponsivePageHeader title="チャット設定" onBack={close} />
          <ResponsivePageBody>
            {query.isError ? (
              <Button onClick={() => void query.refetch()}>再読み込み</Button>
            ) : (
              <p>読み込み中…</p>
            )}
          </ResponsivePageBody>
        </>
      )}
      {action && (
        <ConfirmDialog
          title={
            action === "leave"
              ? "チャットから退出しますか"
              : "チャットを削除しますか"
          }
          confirmLabel={action === "leave" ? "退出" : "削除"}
          onCancel={() => {
            if (!pending) setAction(undefined)
          }}
          onConfirm={() => void confirm()}
        />
      )}
    </RoutePage>
  )
}

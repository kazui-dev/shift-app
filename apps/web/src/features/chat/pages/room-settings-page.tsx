import { useState } from "react"
import { LoadingState } from "@/app/page-layout"
import { useCloseOverlay } from "@/features/chat/components/overlay"
import { keys } from "@/app/data/keys"
import { getRouteApi, useRouter } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { toast } from "@workspace/ui/lib/toast"
import {
  deleteChatRoom,
  getChatRoom,
  leaveChatRoom,
} from "@/features/chat/api/chat"
import { errorMessage } from "@/lib/http/client"
import { removeRoom } from "@/features/chat/data/chat-cache"
import { RoomSettings } from "@/features/chat/components/room/settings"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useChatStore } from "@/features/chat/components/use-chat-store"
import { RoutePage } from "@/app/route-page"

export function RoomSettingsPage() {
  const { roomId } = getRouteApi("/_app/chat/$roomId/info/settings").useParams()
  return <RoomSettingsScreen key={roomId} roomId={roomId} />
}
function RoomSettingsScreen({ roomId }: { roomId: string }) {
  const router = useRouter(),
    client = useQueryClient()
  const { store } = useChatStore()
  const [action, setAction] = useState<"leave" | "delete">()
  const [pending, setPending] = useState(false)
  const close = useCloseOverlay("settings", {
    to: "/chat/$roomId/info",
    params: { roomId },
  })
  const query = useQuery({
    queryKey: keys.chatRoom(roomId),
    queryFn: () => getChatRoom(roomId),
  })
  const room = query.data?.room
  async function confirm() {
    if (!action || pending) return
    setPending(true)
    try {
      if (action === "delete") await deleteChatRoom(roomId)
      else await leaveChatRoom(roomId)
      await router.navigate({
        to: "/chat",
        replace: true,
        state: { chatList: true, chatRemoved: roomId },
      })
      removeRoom(client, roomId)
      await store.removeRoom(roomId)
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
              <LoadingState />
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

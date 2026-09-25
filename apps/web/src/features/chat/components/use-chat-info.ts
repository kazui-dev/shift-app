import { useRouter, useRouterState } from "@tanstack/react-router"
import { useCloseOverlay } from "@/features/chat/components/overlay"

export function useChatInfo(roomId: string | undefined) {
  const router = useRouter()
  const open = useRouterState({
    select: ({ location }) =>
      !!roomId &&
      (location.pathname === `/chat/${roomId}/info` ||
        location.pathname === `/chat/${roomId}/info/settings`),
  })
  const show = () => {
    if (!roomId || open) return
    void router.navigate({
      to: "/chat/$roomId/info",
      params: { roomId },
      state: {
        chatOverlay: "info",
        chatFromList: !!router.history.location.state.chatFromList,
      },
    })
  }
  const unwind = useCloseOverlay("info", {
    to: "/chat/$roomId",
    params: { roomId: roomId ?? "" },
  })
  const close = () => {
    if (roomId && router.history.location.pathname === `/chat/${roomId}/info`)
      unwind()
  }
  return { open, show, close }
}

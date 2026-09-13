import { useRouter, useRouterState } from "@tanstack/react-router"

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
        chatInfo: true,
        chatFromList: !!router.history.location.state.chatFromList,
      },
    })
  }
  const close = () => {
    if (!roomId || router.history.location.pathname !== `/chat/${roomId}/info`)
      return
    if (router.history.location.state.chatInfo) router.history.back()
    else
      void router.navigate({
        to: "/chat/$roomId",
        params: { roomId },
        replace: true,
      })
  }
  return { open, show, close }
}

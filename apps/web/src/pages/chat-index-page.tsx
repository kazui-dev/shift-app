import { useNavigate } from "@tanstack/react-router"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { MessageCircle } from "lucide-react"
import { getChatRooms } from "@/api/chat"
import { useDisplayYear } from "@/components/use-display-year"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useOfflineMode } from "@/components/offline-mode-context"
export function ChatIndexPage() {
  const { year } = useDisplayYear(),
    desktop = useMediaQuery("(min-width: 768px)"),
    navigate = useNavigate(),
    offline = useOfflineMode()
  const rooms = useQuery({
    queryKey: ["chat-rooms", year, false],
    queryFn: year === null ? skipToken : () => getChatRooms(year),
    enabled: !offline,
  })
  const first = rooms.data?.rooms[0]?.id
  useEffect(() => {
    if (desktop && first)
      void navigate({
        to: "/chat/$roomId",
        params: { roomId: first },
        replace: true,
      })
  }, [desktop, first, navigate])
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <MessageCircle className="size-8" aria-label="ルームを選択" />
    </div>
  )
}

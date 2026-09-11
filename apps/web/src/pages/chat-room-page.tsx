import { getRouteApi } from "@tanstack/react-router"
import { ChatConversation } from "@/components/chat/conversation"
const route = getRouteApi("/_app/chat/$roomId")
export function ChatRoomPage() {
  const { roomId } = route.useParams()
  const { report } = route.useSearch()
  return <ChatConversation key={roomId} roomId={roomId} report={report} />
}

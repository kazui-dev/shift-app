import { createFileRoute } from "@tanstack/react-router"
import { ChatPage } from "@/features/chat/pages/chat-page"
export const Route = createFileRoute("/_app/chat")({ component: ChatPage })

import { useSyncExternalStore } from "react"
import { useChatMember } from "@/features/chat/hooks/use-chat-member"
import { chatStore } from "@/features/chat/lib/store"
export function useChatStore() {
  const member = useChatMember()
  const store = chatStore(member.studentId)
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot)
  return { store, member, ...snapshot }
}

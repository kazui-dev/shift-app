import { useSyncExternalStore } from "react"
import { useChatMember } from "@/components/chat/use-chat-member"
import { chatStore } from "@/lib/chat/store"
export function useChatStore() {
  const member = useChatMember()
  const store = chatStore(member.studentId)
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot)
  return { store, member, ...snapshot }
}

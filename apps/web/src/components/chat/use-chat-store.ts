import { useSyncExternalStore } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { chatStore } from "@/lib/chat-store"
export function useChatStore() {
  const { state } = getRouteApi("/_app").useRouteContext()
  const store = chatStore(state.member.studentId)
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot)
  return { store, member: state.member, ...snapshot }
}

import { useRouter, type NavigateOptions } from "@tanstack/react-router"

/** Surfaces pushed on top of a conversation. */
export type ChatOverlay = "create" | "search" | "info" | "settings" | "image"

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** The surface this entry opened, so closing it can go back. */
    chatOverlay?: ChatOverlay
    /** The conversation was opened from the list, so back returns there. */
    chatFromList?: boolean
    chatList?: boolean
    chatRemoved?: string
  }
}

/**
 * Closes an overlay by unwinding the entry that opened it, and otherwise by
 * replacing the current entry, so a shared or reloaded URL still closes.
 */
export function useCloseOverlay(
  overlay: ChatOverlay,
  fallback: NavigateOptions
) {
  const router = useRouter()
  return () => {
    if (router.history.location.state.chatOverlay === overlay)
      router.history.back()
    else void router.navigate({ ...fallback, replace: true })
  }
}

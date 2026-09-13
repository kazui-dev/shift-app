import { getRouteApi } from "@tanstack/react-router"

/** The signed-in member the chat screens act for. */
export function useChatMember() {
  return getRouteApi("/_app").useRouteContext().state.member
}

import { createContext, useContext } from "react"
export type MessageTarget = { roomId: string; messageId: string } | null
export const MessageTargetContext = createContext<{
  target: MessageTarget
  setTarget: (target: MessageTarget) => void
} | null>(null)
export function useMessageTarget() {
  const value = useContext(MessageTargetContext)
  if (!value) throw new Error("Message target provider is missing")
  return value
}

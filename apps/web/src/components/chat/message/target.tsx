import { useState, useMemo, type ReactNode } from "react"
import {
  MessageTargetContext,
  type MessageTarget,
} from "@/components/chat/message/use-target"
export function MessageTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<MessageTarget>(null)
  const value = useMemo(() => ({ target, setTarget }), [target])
  return <MessageTargetContext value={value}>{children}</MessageTargetContext>
}

import type { ReactNode } from "react"
import { useChatPanels } from "./use-chat-panels"

export function ChatPanels({
  showingRoom,
  hasRoom,
  list,
  navigation,
  children,
  onBack,
  onResume,
}: {
  showingRoom: boolean
  hasRoom: boolean
  list: ReactNode
  navigation: ReactNode
  children: ReactNode
  onBack: () => void
  onResume: () => void
}) {
  const {
    viewport,
    list: listPanel,
    conversation: conversationPanel,
  } = useChatPanels({ showingRoom, hasRoom, onBack, onResume })
  return (
    <section
      ref={viewport}
      aria-label="チャット"
      className="min-h-0 min-w-0 flex-1 overflow-clip"
    >
      <div className="flex h-full min-h-0 touch-pan-y touch-pinch-zoom md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          ref={listPanel}
          aria-label="ルーム一覧"
          className="flex min-h-0 min-w-0 flex-[0_0_100%] flex-col md:pr-3"
        >
          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 md:px-0">
            {list}
          </div>
          {navigation}
        </aside>
        <div
          ref={conversationPanel}
          data-chat-panel="conversation"
          className="relative z-10 flex min-h-0 min-w-0 flex-[0_0_100%] flex-col bg-background pb-[env(safe-area-inset-bottom)] md:border-l md:pb-0"
        >
          {children}
        </div>
      </div>
    </section>
  )
}

import type { ReactNode } from "react"
import { useChatPanels } from "./use-chat-panels"

export function ChatPanels({
  showingRoom,
  hasRoom,
  showingMembers,
  members,
  header,
  onMembers,
  onConversation,
  list,
  navigation,
  children,
  onBack,
  onResume,
}: {
  showingRoom: boolean
  hasRoom: boolean
  showingMembers: boolean
  members: ReactNode
  header: ReactNode
  onMembers: () => void
  onConversation: () => void
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
    members: membersPanel,
  } = useChatPanels({
    showingRoom,
    hasRoom,
    showingMembers,
    onBack,
    onResume,
    onMembers,
    onConversation,
  })
  return (
    <section
      ref={viewport}
      aria-label="チャット"
      className="min-h-0 min-w-0 flex-1 overflow-clip"
    >
      <div className="flex h-full min-h-0 touch-pan-y md:grid md:grid-cols-[14rem_minmax(0,1fr)_13rem] md:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_15rem]">
        <aside
          ref={listPanel}
          data-chat-panel="list"
          aria-label="チャット一覧"
          className="flex min-h-0 min-w-0 flex-[0_0_100%] flex-col md:col-start-1 md:row-span-2 md:row-start-1 md:pr-3"
        >
          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 md:px-0">
            {list}
          </div>
          {navigation}
        </aside>
        <div
          ref={conversationPanel}
          data-chat-panel="conversation"
          className="relative z-10 flex min-h-0 min-w-0 flex-[0_0_100%] flex-col bg-background pb-[env(safe-area-inset-bottom)] md:col-start-2 md:row-start-2 md:border-l md:pb-0"
        >
          <div className="shrink-0 md:hidden">{header}</div>
          {children}
        </div>
        <aside
          ref={membersPanel}
          data-chat-panel="members"
          aria-label="チャットメンバー"
          className="relative z-10 flex min-h-0 min-w-0 flex-[0_0_100%] flex-col bg-[color-mix(in_oklab,var(--background),var(--muted)_50%)] pb-[env(safe-area-inset-bottom)] md:col-start-3 md:row-start-2 md:border-l md:pb-0"
        >
          {members}
        </aside>
        <div className="hidden min-w-0 border-l md:col-span-2 md:col-start-2 md:row-start-1 md:block">
          {header}
        </div>
      </div>
    </section>
  )
}

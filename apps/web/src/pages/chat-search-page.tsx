import { useEffect, useState } from "react"
import { useCloseOverlay } from "@/components/chat/overlay"
import { keys } from "@/data/keys"
import { japanMonthDayTime } from "@workspace/shared/japan-time"
import { getRouteApi } from "@tanstack/react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Search, LoaderCircle } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { EmptyState } from "@/components/page-layout"
import { RoutePage } from "@/components/route-page"
import { MemberAvatar } from "@/components/member-avatar"
import { getChatRoom, searchChatMessages } from "@/api/chat"
import { useMessageTarget } from "@/components/chat/message/use-target"

export function ChatSearchPage() {
  const { roomId } = getRouteApi("/_app/chat/$roomId/search").useParams()
  return <ChatSearch key={roomId} roomId={roomId} />
}
function ChatSearch({ roomId }: { roomId: string }) {
  const { setTarget } = useMessageTarget()
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 200)
    return () => clearTimeout(timer)
  }, [input])
  const room = useQuery({
    queryKey: keys.chatRoom(roomId),
    queryFn: () => getChatRoom(roomId),
  })
  const results = useInfiniteQuery({
    queryKey: keys.chatSearch(roomId, query),
    queryFn: ({ pageParam, signal }) =>
      searchChatMessages(roomId, query, pageParam, signal),
    initialPageParam: null as number | null,
    getNextPageParam: (last) =>
      last.hasMore ? last.messages.at(-1)?.sequence : undefined,
    enabled: !!query && input.trim() === query,
    retry: false,
  })
  const current = input.trim() === query
  const waiting =
    !!input.trim() &&
    (!current ||
      results.isPending ||
      (results.isFetching && !results.isFetchingNextPage))
  const loading = current && results.isFetching
  const Icon = loading ? LoaderCircle : Search
  const close = useCloseOverlay("search", {
    to: "/chat/$roomId",
    params: { roomId },
  })
  const messages = results.data?.pages.flatMap((page) => page.messages) ?? []
  return (
    <RoutePage onClose={close}>
      <ResponsivePageHeader title="検索" onBack={close} />
      <div className="px-5 pt-6 pb-4">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground">
            <Icon
              aria-hidden
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
          </span>
          <Input
            type="search"
            aria-label="チャット内を検索"
            placeholder={`${room.data?.room.name ?? "チャット"}を検索`}
            value={input}
            maxLength={200}
            className="pl-9"
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
      </div>
      <ResponsivePageBody>
        <div aria-busy={waiting} className="-mt-6">
          {waiting ? (
            <output className="block space-y-6 py-2">
              <span className="sr-only">検索中</span>
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </output>
          ) : (
            !!input.trim() &&
            current &&
            (results.isError ? (
              <Button variant="ghost" onClick={() => void results.refetch()}>
                再試行
              </Button>
            ) : messages.length ? (
              <div>
                {messages.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    className="-mx-5 flex w-[calc(100%+2.5rem)] gap-3 px-5 py-4 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/5"
                    onClick={() => {
                      setTarget({ roomId, messageId: message.id })
                      close()
                    }}
                  >
                    <MemberAvatar
                      name={message.memberDisplayName}
                      image={message.memberImage}
                      className="size-8 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xs font-medium">
                          {message.memberDisplayName}
                        </span>
                        <time
                          className="text-[11px] text-muted-foreground"
                          dateTime={message.createdAt}
                        >
                          {japanMonthDayTime(message.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </button>
                ))}
                {results.hasNextPage && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={results.isFetchingNextPage}
                    onClick={() => void results.fetchNextPage()}
                  >
                    {results.isFetchingNextPage ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      "さらに表示"
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState>メッセージが見つかりませんでした</EmptyState>
            ))
          )}
        </div>
      </ResponsivePageBody>
    </RoutePage>
  )
}

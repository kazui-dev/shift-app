import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useEffectEvent,
  useRef,
  type FormEvent,
} from "react"
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import useEmblaCarousel from "embla-carousel-react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { createChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { targetsQuery, roomQuery, roomsQuery } from "@/data/chat"
import { useMediaQuery } from "@/hooks/use-media-query"
import { TargetPicker } from "./target-picker"
import { targetKey } from "./target-key"
import { boundPages, pageDrag } from "./page-motion"

export function CreateChat({
  year,
  open,
  onClose,
  onCreated,
}: {
  year: number
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const client = useQueryClient()
  const draftKey = ["chat-draft", year]
  const { data: draft = { name: "", selected: [] } } = useQuery({
    queryKey: draftKey,
    queryFn: skipToken,
    initialData: (): { name: string; selected: string[] } => ({
      name: "",
      selected: [],
    }),
  })
  const { name, selected } = draft
  const setName = (nextName: string) =>
    client.setQueryData(draftKey, { ...draft, name: nextName })
  const setSelected = (nextSelected: string[]) =>
    client.setQueryData(draftKey, { ...draft, selected: nextSelected })
  const nameInput = useRef<HTMLInputElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const targets = useQuery(targetsQuery(year))
  const chosen =
    targets.data?.targets.filter((target) =>
      selected.includes(targetKey(target))
    ) ?? []
  const create = useMutation({
    mutationFn: () =>
      createChatRoom({
        year,
        name: name.trim(),
        targets: chosen.map(({ targetType, targetId }) => ({
          targetType,
          targetId,
        })),
      }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: ({ room }) => {
      client.setQueryData(roomQuery(room.id).queryKey, { room })
      client.setQueryData(roomsQuery(year).queryKey, (current) =>
        current
          ? {
              rooms: [
                room,
                ...current.rooms.filter((item) => item.id !== room.id),
              ],
            }
          : { rooms: [room] }
      )
      void client.invalidateQueries({ queryKey: ["chat-rooms", year] })
      client.setQueryData(draftKey, { name: "", selected: [] })
      onCreated(room.id)
    },
  })
  const closing = useRef(false)
  useLayoutEffect(() => {
    if (open) closing.current = false
  }, [open])
  const requestClose = useCallback(() => {
    if (closing.current || create.isPending) return
    closing.current = true
    onClose()
  }, [create.isPending, onClose])
  const close = useEffectEvent(requestClose)
  const shown = useRef(open)
  useLayoutEffect(() => {
    shown.current = open
  }, [open])
  const pending = useRef(create.isPending)
  useLayoutEffect(() => {
    pending.current = create.isPending
  }, [create.isPending])
  const watchDrag = useCallback(
    (_api: unknown, event: MouseEvent | TouchEvent) =>
      shown.current && !pending.current && pageDrag(event),
    []
  )
  const [viewport, carousel] = useEmblaCarousel({
    active: !desktop,
    startIndex: 0,
    align: "start",
    containScroll: false,
    watchDrag,
    watchFocus: false,
    duration: reducedMotion ? 0 : 20,
  })
  useEffect(() => {
    if (!carousel || desktop) return undefined
    let restore = boundPages(carousel)
    const select = () => {
      if (shown.current && carousel.selectedScrollSnap() === 0) close()
    }
    const reset = () => {
      restore()
      restore = boundPages(carousel)
      carousel.scrollTo(shown.current ? 1 : 0, true)
    }
    carousel.on("select", select).on("reInit", reset)
    return () => {
      carousel.off("select", select).off("reInit", reset)
      restore()
    }
  }, [carousel, desktop])
  useLayoutEffect(() => {
    if (
      !desktop &&
      carousel &&
      carousel.selectedScrollSnap() !== (open ? 1 : 0)
    )
      carousel.scrollTo(open ? 1 : 0, reducedMotion)
  }, [carousel, desktop, open, reducedMotion])
  useEffect(() => {
    if (open && !desktop) page.current?.focus({ preventScroll: true })
  }, [open, desktop])
  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() && chosen.length && !create.isPending) create.mutate()
  }
  const title = desktop ? (
    <DialogTitle className="truncate text-center text-base font-semibold">
      新しいチャット
    </DialogTitle>
  ) : (
    <h1 className="truncate text-center text-base font-semibold">
      新しいチャット
    </h1>
  )
  const form = (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <header className="grid h-16 shrink-0 grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2 border-b px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="戻る"
          disabled={create.isPending}
          onClick={requestClose}
        >
          <ArrowLeft />
        </Button>
        {title}
        <Button
          type="submit"
          size="sm"
          disabled={
            !name.trim() ||
            !chosen.length ||
            create.isPending ||
            targets.isError
          }
        >
          {create.isPending ? "作成中" : "作成"}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:[scrollbar-width:none]">
        <fieldset disabled={create.isPending} className="min-w-0 space-y-5">
          <div className="space-y-2.5">
            <label
              htmlFor="new-chat-name"
              className="block text-sm font-medium"
            >
              チャット名
            </label>
            <Input
              ref={nameInput}
              id="new-chat-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <TargetPicker
            targets={targets.data?.targets ?? []}
            selected={selected}
            onChange={setSelected}
          />
        </fieldset>
      </div>
    </form>
  )
  if (desktop)
    return (
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) requestClose()
        }}
      >
        <DialogContent
          initialFocus={nameInput}
          showCloseButton={false}
          className="flex h-[min(44rem,85dvh)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[38rem]"
        >
          {form}
        </DialogContent>
      </Dialog>
    )
  return (
    <div
      ref={viewport}
      inert={!open}
      aria-hidden={!open}
      className={`absolute inset-0 z-30 overflow-clip ${open ? "" : "pointer-events-none"}`}
      aria-label="新しいチャット"
    >
      <div className="flex h-full touch-pan-y touch-pinch-zoom">
        <div aria-hidden className="min-w-0 flex-[0_0_100%]" />
        <div
          ref={page}
          tabIndex={-1}
          className="flex h-full min-w-0 flex-[0_0_100%] flex-col bg-background pt-[env(safe-area-inset-top)] outline-none"
        >
          {form}
        </div>
      </div>
    </div>
  )
}

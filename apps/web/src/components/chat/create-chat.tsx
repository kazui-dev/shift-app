import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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

export function CreateChat({
  year,
  onClose,
  onCreated,
}: {
  year: number
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const client = useQueryClient()
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const nameInput = useRef<HTMLInputElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const targets = useQuery({ ...targetsQuery(year), refetchOnMount: "always" })
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
      onCreated(room.id)
    },
  })
  const closing = useRef(false)
  const requestClose = () => {
    if (closing.current || create.isPending) return
    closing.current = true
    onClose()
  }
  useEffect(() => {
    if (!desktop) page.current?.focus({ preventScroll: true })
  }, [desktop])
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
          <ArrowLeft className="size-5" />
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
      <div className="min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-y-auto overscroll-x-contain overscroll-y-auto px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:[scrollbar-width:none]">
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
        open
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
      ref={page}
      tabIndex={-1}
      aria-label="新しいチャット"
      className="absolute inset-0 z-30 flex min-w-0 animate-in flex-col overflow-clip bg-background pt-[env(safe-area-inset-top)] duration-300 ease-out outline-none slide-in-from-right-full motion-reduce:animate-none"
    >
      {form}
    </div>
  )
}

import { useState, type FormEvent } from "react"
import { useChatMember } from "@/features/chat/components/use-chat-member"
import { keys } from "@/app/data/keys"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { ChatNameField } from "@/features/chat/components/room/name-field"
import { toast } from "@workspace/ui/lib/toast"
import { createChatRoom } from "@/features/chat/api/chat"
import { errorMessage } from "@/lib/http/client"
import { targetsQuery, roomQuery, roomsQuery } from "@/features/chat/data/chat"
import { TargetPicker } from "@/features/chat/components/room/target-picker"
import { targetKey } from "@/features/chat/components/room/target-key"

export function CreateChat({
  year,
  onClose,
  onCreated,
}: {
  year: number
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const client = useQueryClient()
  const member = useChatMember()
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const targets = useQuery({ ...targetsQuery(year), refetchOnMount: "always" })
  const candidates =
    targets.data?.targets.filter(
      (target) =>
        target.targetType !== "member" || target.targetId !== member.id
    ) ?? []
  const chosen =
    candidates.filter((target) => selected.includes(targetKey(target))) ?? []
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
      void client.invalidateQueries({ queryKey: keys.chatRooms(year) })
      onCreated(room.id)
    },
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() && chosen.length && !create.isPending) create.mutate()
  }
  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ResponsivePageHeader
        title="新しいチャット"
        onBack={onClose}
        backDisabled={create.isPending}
        action={
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
        }
      />
      <ResponsivePageBody>
        <fieldset disabled={create.isPending} className="min-w-0 space-y-5">
          <ChatNameField id="new-chat-name" value={name} onChange={setName} />
          <TargetPicker
            targets={candidates}
            selected={selected}
            onChange={setSelected}
          />
        </fieldset>
      </ResponsivePageBody>
    </form>
  )
}

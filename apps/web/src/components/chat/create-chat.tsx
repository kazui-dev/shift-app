import { useState, type FormEvent } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { ChatNameField } from "./name-field"
import { toast } from "@workspace/ui/lib/toast"
import { createChatRoom } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { targetsQuery, roomQuery, roomsQuery } from "@/data/chat"
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
  const client = useQueryClient()
  const { state } = getRouteApi("/_app").useRouteContext()
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const targets = useQuery({ ...targetsQuery(year), refetchOnMount: "always" })
  const candidates =
    targets.data?.targets.filter(
      (target) =>
        target.targetType !== "member" || target.targetId !== state.member.id
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
      void client.invalidateQueries({ queryKey: ["chat-rooms", year] })
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

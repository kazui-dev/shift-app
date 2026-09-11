import { useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { Input } from "@workspace/ui/components/input"
import { createChatRoom, getChatTargets } from "@/api/chat"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"

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
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const targets = useQuery({
    queryKey: ["chat-targets", year],
    queryFn: () => getChatTargets(year),
  })
  const members =
    targets.data?.targets.filter((target) => target.targetType === "member") ??
    []
  const selectedMembers = members.filter((member) =>
    selected.includes(member.targetId)
  )
  const candidates = members.filter((member) =>
    member.displayName
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )
  const create = useMutation({
    mutationFn: () =>
      createChatRoom({
        year,
        name: name.trim(),
        targets: selectedMembers.map((member) => ({
          targetType: "member",
          targetId: member.targetId,
        })),
      }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async ({ room }) => {
      await client.invalidateQueries({ queryKey: ["chat-rooms"] })
      onCreated(room.id)
    },
  })
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() && selectedMembers.length && !create.isPending)
      create.mutate()
  }
  return (
    <ResponsiveDialog
      open
      title="新しいチャット"
      initialFocus={nameInput}
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose()
      }}
    >
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={create.isPending} className="min-w-0 space-y-5">
          <label
            htmlFor="new-chat-name"
            className="block space-y-2 text-sm font-medium"
          >
            チャット名
            <Input
              id="new-chat-name"
              ref={nameInput}
              autoComplete="off"
              maxLength={120}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="new-chat-search" className="font-medium">
                メンバー
              </label>
              {selectedMembers.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedMembers.length}人を選択中
                </span>
              )}
            </div>
            {selectedMembers.length > 0 && (
              <ul
                aria-label="選択したメンバー"
                className="flex max-h-24 flex-wrap gap-2 overflow-y-auto"
              >
                {selectedMembers.map((member) => (
                  <li
                    key={member.targetId}
                    className="flex max-w-full min-w-0 items-center gap-1 rounded-md bg-muted py-1 pl-2 text-xs"
                  >
                    <span className="truncate">{member.displayName}</span>
                    <button
                      type="button"
                      aria-label={`${member.displayName}の選択を解除`}
                      onClick={() => toggle(member.targetId)}
                      className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-foreground/10"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="new-chat-search"
                type="search"
                placeholder="名前で検索"
                autoComplete="off"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {targets.isPending && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  読み込み中…
                </p>
              )}
              {targets.isSuccess && !candidates.length && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  該当するメンバーはいません
                </p>
              )}
              <ul>
                {candidates.map((member) => (
                  <li key={member.targetId}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selected.includes(member.targetId)}
                        disabled={
                          !selected.includes(member.targetId) &&
                          selected.length >= 100
                        }
                        onChange={() => toggle(member.targetId)}
                      />
                      <span className="truncate">{member.displayName}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={create.isPending}
            onClick={onClose}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            disabled={
              !name.trim() ||
              !selectedMembers.length ||
              create.isPending ||
              targets.isError
            }
          >
            {create.isPending ? "作成中…" : "作成"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { YearTag } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { keys } from "@/app/data/keys"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { SearchableList } from "@/components/searchable-list"
import { errorMessage } from "@/lib/http/client"
import { deleteTag, saveTag } from "../api/tags"

export function TagManager({
  year,
  tags,
  onClose,
  onDirtyChange,
}: {
  year: number
  tags: YearTag[]
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const [editing, setEditing] = useState<YearTag | null>(null)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState<YearTag | null>(null)
  const [discarding, setDiscarding] = useState(false)
  const dirty = name !== (editing?.name ?? "")
  useEffect(() => {
    onDirtyChange(dirty || pending)
    return () => onDirtyChange(false)
  }, [dirty, pending, onDirtyChange])
  async function save() {
    setPending(true)
    try {
      await saveTag(year, name, editing?.id)
      setName("")
      setEditing(null)
      await client.invalidateQueries({ queryKey: keys.yearTags(year) })
      toast.success("タグを保存しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  async function remove(tag: YearTag) {
    setPending(true)
    try {
      await deleteTag(year, tag.id)
      if (editing?.id === tag.id) {
        setEditing(null)
        setName("")
      }
      await client.invalidateQueries({ queryKey: keys.yearTags(year) })
      toast.success("タグを削除しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <ResponsiveDialog
        open
        title="タグを管理"
        onOpenChange={(open) => {
          if (!open && !pending) {
            if (dirty) setDiscarding(true)
            else onClose()
          }
        }}
      >
        <div className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!pending && name.trim() && name.trim().length <= 100)
                void save()
            }}
          >
            <label className="min-w-0 flex-1 space-y-1 text-sm">
              <span>{editing ? "タグ名を変更" : "新しいタグ"}</span>
              <Input
                value={name}
                maxLength={100}
                required
                disabled={pending}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !name.trim() || !dirty}
            >
              {editing ? "保存" : "作成"}
            </Button>
            {editing && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setEditing(null)
                  setName("")
                }}
              >
                キャンセル
              </Button>
            )}
          </form>
          <SearchableList
            label="タグ"
            items={tags}
            getSearchText={(tag) => tag.name}
          >
            {(tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 break-words">
                  {tag.name}
                  <span className="ml-2 text-muted-foreground">
                    {tag.memberIds.length}人
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || dirty}
                  onClick={() => {
                    setEditing(tag)
                    setName(tag.name)
                  }}
                >
                  名前変更
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending || dirty}
                  onClick={() => setDeleting(tag)}
                >
                  削除
                </Button>
              </div>
            )}
          </SearchableList>
          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground">
              タグはまだありません。
            </p>
          )}
        </div>
      </ResponsiveDialog>
      {deleting && (
        <ConfirmDialog
          title={`「${deleting.name}」を削除しますか`}
          description={`付与中の${deleting.memberIds.length}人からも、このタグを解除します。`}
          confirmLabel="削除"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const tag = deleting
            setDeleting(null)
            void remove(tag)
          }}
        />
      )}
      {discarding && (
        <ConfirmDialog
          title="変更を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setDiscarding(false)}
          onConfirm={onClose}
        />
      )}
    </>
  )
}

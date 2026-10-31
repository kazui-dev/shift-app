import { useEffect, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { YearTag } from "@workspace/shared/shifts"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { ManagementEditorForm } from "@/features/management/components/editor-form"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { keys } from "@/app/data/keys"
import { errorMessage } from "@/lib/http/client"
import { createTag, updateTag, deleteTag } from "../api/tags"

export function TagEditor({
  year,
  tag,
  onStatusChange,
  onClose,
  onDeleted,
}: {
  year: number
  tag: YearTag | null
  onStatusChange: (status: { dirty: boolean; pending: boolean }) => void
  onClose: () => void
  onDeleted: () => void
}) {
  const client = useQueryClient()
  const [name, setName] = useState(tag?.name ?? "")
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const dirty = name !== (tag?.name ?? "")
  const valid = name.trim().length > 0 && name.trim().length <= 100
  useEffect(() => {
    onStatusChange({ dirty, pending })
    return () => onStatusChange({ dirty: false, pending: false })
  }, [dirty, pending, onStatusChange])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!dirty || !valid || pending) return
    setPending(true)
    try {
      if (tag) await updateTag(year, tag.id, { name })
      else await createTag(year, { name })
      await client.invalidateQueries({ queryKey: keys.yearTags(year) })
      toast.success("タグを保存しました。")
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  async function remove() {
    if (!tag || pending) return
    setDeleting(false)
    setPending(true)
    try {
      await deleteTag(year, tag.id)
      await client.invalidateQueries({ queryKey: keys.yearTags(year) })
      toast.success("タグを削除しました。")
      onDeleted()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <ManagementEditorForm
      editable
      dirty={dirty}
      pending={pending}
      valid={valid}
      submitLabel={tag ? "保存" : "作成"}
      onSubmit={save}
      onClose={onClose}
      footer={
        tag && (
          <div className="border-t pt-5">
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(true)}
            >
              タグを削除
            </Button>
          </div>
        )
      }
    >
      <label htmlFor="tag-name" className="flex flex-col gap-2 text-sm">
        タグ名
        <Input
          id="tag-name"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {deleting && tag && (
        <ConfirmDialog
          title={`「${tag.name}」を削除しますか`}
          description="メンバーへのタグの付与も解除されます。"
          confirmLabel="削除"
          onCancel={() => setDeleting(false)}
          onConfirm={() => void remove()}
        />
      )}
    </ManagementEditorForm>
  )
}

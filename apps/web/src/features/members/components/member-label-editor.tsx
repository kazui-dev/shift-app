import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { SearchableList } from "@/components/searchable-list"
import { SelectField } from "@/components/select-field"
import { errorMessage } from "@/lib/http/client"
import { MemberLabels } from "./member-labels"

export function MemberLabelEditor({
  label,
  memberIds,
  items,
  onApply,
  onClose,
  onApplied,
  onDirtyChange,
  onPendingChange,
}: {
  label: string
  memberIds: string[]
  items: { id: string; name: string; memberIds: string[] }[]
  onApply: (add: string[], remove: string[]) => Promise<void>
  onClose: () => void
  onApplied: () => void
  onPendingChange?: ((pending: boolean) => void) | undefined
  onDirtyChange: (dirty: boolean) => void
}) {
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  useEffect(() => {
    onPendingChange?.(pending)
    return () => onPendingChange?.(false)
  }, [pending, onPendingChange])
  const [discarding, setDiscarding] = useState(false)
  const add = Object.keys(changes).filter((id) => changes[id] === "add")
  const remove = Object.keys(changes).filter((id) => changes[id] === "remove")
  const dirty = add.length + remove.length > 0
  useEffect(() => {
    onDirtyChange(dirty || pending)
    return () => onDirtyChange(false)
  }, [dirty, pending, onDirtyChange])
  async function apply() {
    setPending(true)
    try {
      await onApply(add, remove)
      toast.success(`${label}を更新しました。`)
      onApplied()
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
        title={`${label}を変更`}
        onOpenChange={(open) => {
          if (!open && !pending) {
            if (dirty) setDiscarding(true)
            else onClose()
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {memberIds.length}人に適用
          </p>
          <SearchableList
            label={label}
            items={items}
            getSearchText={(item) => item.name}
          >
            {(item) => {
              const count = memberIds.filter((id) =>
                item.memberIds.includes(id)
              ).length
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0"
                >
                  <div className="min-w-0 space-y-1">
                    <MemberLabels items={[item]} />
                    <p className="text-xs text-muted-foreground">
                      {count}/{memberIds.length}人に付与済み
                    </p>
                  </div>
                  <SelectField
                    aria-label={`${item.name}の変更`}
                    size="default"
                    className="w-auto shrink-0"
                    disabled={pending}
                    value={changes[item.id] ?? "keep"}
                    onValueChange={(value) =>
                      setChanges((current) => ({
                        ...current,
                        [item.id]: value,
                      }))
                    }
                    options={[
                      { value: "keep", label: "変更しない" },
                      { value: "add", label: "付与" },
                      { value: "remove", label: "解除" },
                    ]}
                  />
                </div>
              )
            }}
          </SearchableList>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {label}がありません。先に{label}を作成してください。
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (dirty) setDiscarding(true)
                else onClose()
              }}
            >
              キャンセル
            </Button>
            <Button
              data-save-shortcut
              disabled={pending || !dirty}
              onClick={() => void apply()}
            >
              適用
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
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

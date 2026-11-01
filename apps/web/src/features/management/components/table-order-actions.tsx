import { Button } from "@workspace/ui/components/button"
import { ManagementHeaderActions } from "./header-actions"

export function TableOrderActions({
  dirty,
  pending,
  onSave,
  onCancel,
}: {
  dirty: boolean
  pending: boolean
  onSave: () => Promise<void>
  onCancel: () => void
}) {
  return (
    <ManagementHeaderActions placement="start">
      {dirty && (
        <>
          <Button
            data-save-shortcut
            size="sm"
            disabled={pending}
            onClick={() => void onSave()}
          >
            {pending ? "保存中…" : "並び順を保存"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            キャンセル
          </Button>
        </>
      )}
    </ManagementHeaderActions>
  )
}

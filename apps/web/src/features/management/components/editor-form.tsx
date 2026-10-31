import { useId, useState, type FormEvent, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ManagementHeaderActions } from "./header-actions"

export function ManagementEditorForm({
  children,
  footer,
  editable,
  dirty,
  pending,
  valid,
  submitLabel,
  readOnlyMessage,
  onSubmit,
  onClose,
}: {
  children: ReactNode
  footer?: ReactNode
  editable: boolean
  dirty: boolean
  pending: boolean
  valid: boolean
  submitLabel: string
  readOnlyMessage?: string
  onSubmit: (event: FormEvent) => Promise<void>
  onClose: () => void
}) {
  const formId = useId()
  const [discarding, setDiscarding] = useState(false)
  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl min-w-0 space-y-6"
    >
      <ManagementHeaderActions>
        <Button
          size="sm"
          variant="outline"
          type="submit"
          form={formId}
          disabled={!editable || pending || !dirty || !valid}
        >
          {pending ? "保存中…" : submitLabel}
        </Button>
      </ManagementHeaderActions>
      {!editable && readOnlyMessage && (
        <p className="text-sm text-muted-foreground">{readOnlyMessage}</p>
      )}
      <fieldset disabled={!editable || pending} className="space-y-6">
        {children}
      </fieldset>
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        {dirty && (
          <span className="mr-auto text-xs text-muted-foreground">
            未保存の変更
          </span>
        )}
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (dirty) setDiscarding(true)
            else onClose()
          }}
        >
          キャンセル
        </Button>
      </div>
      {footer}
      {discarding && (
        <ConfirmDialog
          title="変更を破棄しますか"
          confirmLabel="破棄して戻る"
          onCancel={() => setDiscarding(false)}
          onConfirm={onClose}
        />
      )}
    </form>
  )
}

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

export function ConfirmDialog({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <AlertDialogContent
        size="sm"
        finalFocus={false}
        aria-describedby={undefined}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title.replace(/[？?。]+$/, "")}？
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">キャンセル</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!open}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

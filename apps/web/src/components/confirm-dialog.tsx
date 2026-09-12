import { useRef, useState } from "react"
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
  onClosed,
}: {
  title: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  onClosed?: () => void
}) {
  const [open, setOpen] = useState(true)
  const confirmed = useRef(false)
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
      }}
      onOpenChangeComplete={(next) => {
        if (next) return
        if (!confirmed.current) onCancel()
        else onClosed?.()
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
              confirmed.current = true
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

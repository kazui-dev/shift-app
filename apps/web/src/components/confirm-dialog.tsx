import { useRef, useState, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = "destructive",
  onCancel,
  onConfirm,
  onClosed,
}: {
  title: string
  /** What happens either way, when the title alone does not say it. */
  description?: ReactNode
  confirmLabel: string
  /** `default` for a choice that removes nothing. */
  tone?: "destructive" | "default"
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
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title.replace(/[？?。]+$/, "")}？
          </AlertDialogTitle>
          {description && (
            // Japanese breaks between phrases, never inside a word.
            <AlertDialogDescription className="[word-break:auto-phrase]">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">キャンセル</AlertDialogCancel>
          <AlertDialogAction
            variant={tone}
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

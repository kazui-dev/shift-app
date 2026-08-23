import { Button } from "@workspace/ui/components/button"

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/30 md:items-center md:justify-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="閉じる"
        onClick={onCancel}
      />
      <section
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full rounded-t-2xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:max-w-sm md:rounded-2xl md:border md:p-6"
      >
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  )
}

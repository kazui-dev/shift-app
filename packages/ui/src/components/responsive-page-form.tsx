import { useRef, useState, type ReactNode } from "react"

export function ResponsivePageForm({
  onSave,
  onClose,
  onError,
  closeOnSave = true,
  disabled = false,
  children,
}: {
  onSave: () => Promise<void>
  onClose: () => void
  onError: (error: unknown) => void
  closeOnSave?: boolean
  disabled?: boolean
  children: (pending: boolean) => ReactNode
}) {
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  async function save() {
    if (disabled || saving.current) return
    saving.current = true
    setPending(true)
    try {
      await onSave()
      if (closeOnSave) onClose()
    } catch (error) {
      onError(error)
    } finally {
      saving.current = false
      setPending(false)
    }
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {children(pending)}
    </form>
  )
}

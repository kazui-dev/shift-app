import { TriangleAlert } from "lucide-react"

export function AssignmentEditWarning({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="note"
      className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
    >
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

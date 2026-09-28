import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

/** A titled group of settings, drawn as one card. */
export function SettingsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-medium text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {children}
      </div>
    </section>
  )
}

/**
 * One setting: what it is on the left, what it is set to on the right. The row
 * holds a settled height whatever the control, so nothing shifts as values
 * arrive.
 */
export function SettingsRow({
  label,
  htmlFor,
  description,
  control,
  children,
  className,
}: {
  /** Left off when the section's own title already names the setting. */
  label?: string
  htmlFor?: string
  description?: string
  control?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const Label = htmlFor ? "label" : "span"
  return (
    <div className={cn("px-4 py-3.5", className)}>
      <div className="flex min-h-9 items-center justify-between gap-4">
        {label && (
          <div className="min-w-0">
            <Label
              {...(htmlFor ? { htmlFor } : {})}
              className="block text-sm font-medium"
            >
              {label}
            </Label>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}
        {control && <div className="ml-auto shrink-0">{control}</div>}
      </div>
      {children}
    </div>
  )
}

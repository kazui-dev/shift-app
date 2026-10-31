import type { ReactNode } from "react"
import { Button } from "./button"
export function TableSelectionActions({
  count,
  hiddenCount,
  disabled,
  onClear,
  children,
}: {
  count: number
  hiddenCount: number
  disabled: boolean
  onClear: () => void
  children?: ReactNode
}) {
  if (!count) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="mr-1 font-medium">
        {count}人選択中
        {hiddenCount > 0 && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            （表示外{hiddenCount}人）
          </span>
        )}
      </span>
      {children}
      <Button variant="outline" size="sm" disabled={disabled} onClick={onClear}>
        選択を解除
      </Button>
    </div>
  )
}

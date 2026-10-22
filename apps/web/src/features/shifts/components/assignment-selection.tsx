import { useRef, useState, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@/components/confirm-dialog"

import {
  type AssignmentSelection,
  type useAssignmentSelection,
} from "./use-assignment-selection"

export function AssignmentSelectionToolbar({
  selection,
  pending,
  details,
  onAssign,
  summary,
  onRemove,
}: {
  selection: ReturnType<typeof useAssignmentSelection>
  pending: boolean
  details: { key: string; name: string; activity: string; time: string }[]
  onAssign?: () => void
  summary?: string
  onRemove: () => void
}) {
  const [armed, setArmed] = useState("")
  const signature = `${selection.revision}:${JSON.stringify([...selection.keys].sort())}`
  if (!selection.active) return null
  const selectedDetails = details.filter((item) =>
    selection.keys.includes(item.key)
  )
  return (
    <>
      <div
        className="flex items-center gap-2 text-sm"
        aria-label="勤務の一括選択"
      >
        <output className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {summary ?? `${selection.keys.length}件選択中`}
        </output>
        {onAssign && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onAssign}
          >
            一括割当
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !selectedDetails.length}
          onClick={() => setArmed(signature)}
        >
          割当解除
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={selection.end}
        >
          取消
        </Button>
      </div>
      {armed === signature && (
        <ConfirmDialog
          title={`${selectedDetails.length}件の勤務配置を解除しますか`}
          confirmLabel="割当解除"
          onCancel={() => setArmed("")}
          onConfirm={() => {
            setArmed("")
            onRemove()
          }}
          description={
            <>
              <span className="block">変更は保存すると確定します。</span>
              <span className="mt-3 block max-h-60 divide-y overflow-y-auto text-left">
                {selectedDetails.map((item) => (
                  <span key={item.key} className="block py-2">
                    <span className="flex items-baseline justify-between gap-3 text-foreground">
                      <span className="min-w-0 break-words">{item.name}</span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {item.time}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs">
                      {item.activity}
                    </span>
                  </span>
                ))}
              </span>
            </>
          }
        />
      )}
    </>
  )
}

export function AssignmentSelectAll({
  selection,
}: {
  selection: AssignmentSelection
}) {
  return (
    <input
      type="checkbox"
      className="mr-2"
      aria-label="表示中の勤務をすべて選択"
      ref={(element) => {
        if (element)
          element.indeterminate =
            selection.keys.length > 0 &&
            selection.keys.length < selection.available.length
      }}
      checked={
        selection.available.length > 0 &&
        selection.keys.length === selection.available.length
      }
      disabled={!selection.available.length}
      onChange={(event) =>
        selection.replace(event.target.checked ? selection.available : [])
      }
    />
  )
}

export function AssignmentRowCheckbox({
  selection,
  keys,
  name,
}: {
  selection: AssignmentSelection
  keys: string[]
  name: string
}) {
  const count = keys.filter((key) => selection.keys.includes(key)).length
  return (
    <input
      type="checkbox"
      className="shrink-0"
      aria-label={`${name}を選択`}
      disabled={!keys.length}
      checked={keys.length > 0 && count === keys.length}
      ref={(element) => {
        if (element) element.indeterminate = count > 0 && count < keys.length
      }}
      onChange={(event) =>
        selection.replace(
          event.target.checked
            ? [...new Set([...selection.keys, ...keys])]
            : selection.keys.filter((key) => !keys.includes(key))
        )
      }
    />
  )
}

export function AssignmentSelectionArea({
  selection,
  children,
}: {
  selection: ReturnType<typeof useAssignmentSelection> | undefined
  children: ReactNode
}) {
  const drag = useRef<{
    x: number
    y: number
    base: string[]
    additive: boolean
    moved: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const [box, setBox] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  return (
    <div
      className="relative min-w-0"
      onPointerDownCapture={(event) => {
        if (
          !selection?.active ||
          event.pointerType !== "mouse" ||
          event.button !== 0 ||
          !(event.target instanceof Element) ||
          !event.target.closest("[data-selection-surface]") ||
          event.target.closest("[data-assignment-key]")
        )
          return
        event.stopPropagation()
        event.preventDefault()
        suppressClick.current = false
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          base: selection.keys,
          additive: event.ctrlKey || event.metaKey || event.shiftKey,
          moved: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMoveCapture={(event) => {
        const current = drag.current
        if (!current || !selection) return
        event.stopPropagation()
        if (
          !current.moved &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4
        )
          return
        current.moved = true
        const left = Math.min(current.x, event.clientX),
          top = Math.min(current.y, event.clientY)
        const right = Math.max(current.x, event.clientX),
          bottom = Math.max(current.y, event.clientY)
        const bounds = event.currentTarget.getBoundingClientRect()
        setBox({
          left: left - bounds.left,
          top: top - bounds.top,
          width: right - left,
          height: bottom - top,
        })
        const keys = Array.from(
          event.currentTarget.querySelectorAll("[data-assignment-key]")
        ).flatMap((element) => {
          const rect = element.getBoundingClientRect(),
            key = element.getAttribute("data-assignment-key")
          return key &&
            Math.max(rect.left, bounds.left) < right &&
            Math.min(rect.right, bounds.right) > left &&
            rect.top < bottom &&
            rect.bottom > top
            ? [key]
            : []
        })
        selection.replace([
          ...new Set([...(current.additive ? current.base : []), ...keys]),
        ])
      }}
      onPointerUpCapture={(event) => {
        const current = drag.current
        if (!current) return
        event.stopPropagation()
        suppressClick.current = true
        if (!current.moved && !current.additive) selection?.replace([])
        drag.current = null
        setBox(null)
      }}
      onPointerCancel={() => {
        if (drag.current) selection?.replace(drag.current.base)
        drag.current = null
        setBox(null)
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.stopPropagation()
        event.preventDefault()
      }}
    >
      {children}
      {box && selection?.active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-40 border border-primary bg-primary/10"
          style={box}
        />
      )}
    </div>
  )
}

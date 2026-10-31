import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import {
  DragDropProvider,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/react"
import { Accessibility } from "@dnd-kit/dom"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import { GripVertical } from "lucide-react"
import { TableRow } from "./table"
import type { DataTableRowProps } from "./data-table"
import { cn } from "@workspace/ui/lib/utils"

type Item = { id: string; label: string; disabled: boolean }
const ItemsContext = createContext<readonly Item[]>([])
const HandleContext = createContext<{
  ref: (element: Element | null) => void
  disabled: boolean
} | null>(null)

export function SortableTable({
  items,
  onMove,
  onDraggingChange,
  children,
}: {
  items: readonly Item[]
  onMove: (from: string, to: string) => void
  onDraggingChange: (dragging: boolean) => void
  children: ReactNode
}) {
  const snapshot = useRef(items)
  return (
    <ItemsContext value={items}>
      <DragDropProvider
        plugins={(defaults) => [
          ...defaults.filter((plugin) => plugin !== Accessibility),
          Accessibility.configure({
            screenReaderInstructions: {
              draggable:
                "SpaceまたはEnterで並べ替えを開始し、上下矢印で移動、SpaceまたはEnterで確定、Escapeでキャンセルします。",
            },
            announcements: {
              dragstart: ({ operation }: DragStartEvent) =>
                `${items.find((item) => item.id === operation.source?.id)?.label ?? "行"}の並べ替えを開始しました。`,
              dragover: ({ operation }: DragOverEvent) =>
                isSortable(operation.source)
                  ? `${operation.source.index + 1}番目に移動しました。`
                  : undefined,
              dragend: ({ canceled }: DragEndEvent) =>
                canceled
                  ? "並べ替えをキャンセルしました。"
                  : "並べ替えを終了しました。",
            },
          }),
        ]}
        onDragStart={() => {
          snapshot.current = items
          onDraggingChange(true)
        }}
        onDragEnd={(event) => {
          const source = event.operation.source
          if (!event.canceled && isSortable(source)) {
            const from = snapshot.current[source.initialIndex]
            const to = snapshot.current[source.index]
            if (
              from &&
              to &&
              !from.disabled &&
              !to.disabled &&
              from.id !== to.id
            )
              onMove(from.id, to.id)
          }
          onDraggingChange(false)
        }}
      >
        {children}
      </DragDropProvider>
    </ItemsContext>
  )
}

export function SortableTableRow({
  rowId,
  rowIndex,
  className,
  ...props
}: DataTableRowProps) {
  const items = useContext(ItemsContext)
  const disabled = items.find((item) => item.id === rowId)?.disabled ?? true
  const { ref, handleRef, isDragging } = useSortable({
    id: rowId,
    index: rowIndex,
    disabled,
  })
  const handle = useMemo(
    () => ({ ref: handleRef, disabled }),
    [handleRef, disabled]
  )
  return (
    <HandleContext value={handle}>
      <TableRow
        ref={ref}
        className={cn(
          className,
          isDragging && "z-30 bg-background shadow-md ring-1 ring-border"
        )}
        {...props}
      />
    </HandleContext>
  )
}

export function TableDragHandle({ label }: { label: string }) {
  const handle = useContext(HandleContext)
  return (
    <button
      type="button"
      ref={handle?.ref}
      disabled={!handle || handle.disabled}
      aria-label={`${label}を並べ替え`}
      title="ドラッグして並べ替え"
      className="relative z-10 flex size-8 touch-none items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring enabled:cursor-grab enabled:active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
    >
      <GripVertical className="size-4" />
    </button>
  )
}

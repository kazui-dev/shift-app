import { useRef, type ReactNode } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

/** A full mobile page and a desktop dialog, sharing one content lifecycle. */
export function ResponsivePage({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  return (
    <div ref={container} className="contents">
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose()
        }}
      >
        <Dialog.Portal container={container}>
          <Dialog.Backdrop className="fixed inset-0 z-50 hidden bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs motion-reduce:animate-none md:block data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Popup
            ref={popup}
            initialFocus={() => popup.current}
            className="absolute inset-0 z-50 flex min-h-0 min-w-0 flex-col overflow-clip bg-background pt-[env(safe-area-inset-top)] duration-300 ease-out outline-none motion-reduce:animate-none md:fixed md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(44rem,85dvh)] md:w-[38rem] md:max-w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:bg-popover md:pt-0 md:text-popover-foreground md:ring-1 md:ring-foreground/10 md:duration-100 data-open:animate-in data-open:slide-in-from-right-full md:data-open:fade-in-0 md:data-open:slide-in-from-right-0 md:data-open:zoom-in-95 data-closed:animate-out data-closed:slide-out-to-right-full md:data-closed:fade-out-0 md:data-closed:slide-out-to-right-0 md:data-closed:zoom-out-95"
          >
            {children}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export function ResponsivePageHeader({
  title,
  onBack,
  backDisabled,
  action,
}: {
  title: string
  onBack: () => void
  backDisabled?: boolean
  action?: ReactNode
}) {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2 border-b px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="戻る"
        disabled={backDisabled}
        onClick={onBack}
      >
        <ArrowLeft className="size-5" />
      </Button>
      <Dialog.Title className="truncate text-center text-base font-semibold">
        {title}
      </Dialog.Title>
      {action}
    </header>
  )
}

export function ResponsivePageBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-y-auto overscroll-x-contain overscroll-y-auto px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:[scrollbar-width:none]">
      {children}
    </div>
  )
}

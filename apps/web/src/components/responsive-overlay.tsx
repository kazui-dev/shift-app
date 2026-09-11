import { X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

import { useMediaQuery } from "@/hooks/use-media-query"

type ResponsiveOverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  initialFocus?: React.RefObject<HTMLElement | null>
}

function DrawerView({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  initialFocus,
}: ResponsiveOverlayProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerContent
        initialFocus={initialFocus}
        className={cn("max-h-[85dvh]", className)}
      >
        <DrawerHeader className="gap-2 border-b px-5 py-3 text-left">
          <div className="flex items-center gap-3">
            <DrawerTitle className="min-w-0 flex-1">{title}</DrawerTitle>
            <DrawerClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label="閉じる" />
              }
            >
              <X />
            </DrawerClose>
          </div>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function ResponsiveDialog(props: ResponsiveOverlayProps) {
  const desktop = useMediaQuery("(min-width: 768px)")

  if (!desktop) return <DrawerView {...props} />

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        initialFocus={props.initialFocus}
        showCloseButton={false}
        className={cn("gap-0 p-0", props.className)}
      >
        <DialogHeader className="gap-2 border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <DialogTitle className="min-w-0 flex-1">{props.title}</DialogTitle>
            <DialogClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label="閉じる" />
              }
            >
              <X />
            </DialogClose>
          </div>
          {props.description && (
            <DialogDescription>{props.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="max-h-[min(70dvh,36rem)] overflow-y-auto overscroll-contain p-5">
          {props.children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ResponsiveSheet(props: ResponsiveOverlayProps) {
  const desktop = useMediaQuery("(min-width: 768px)")

  if (!desktop) return <DrawerView {...props} />

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        initialFocus={props.initialFocus}
        className={cn("w-[28rem] max-w-full gap-0", props.className)}
        side="right"
        showCloseButton={false}
      >
        <SheetHeader className="gap-2 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <SheetTitle className="min-w-0 flex-1">{props.title}</SheetTitle>
            <SheetClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label="閉じる" />
              }
            >
              <X />
            </SheetClose>
          </div>
          {props.description && (
            <SheetDescription>{props.description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          {props.children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

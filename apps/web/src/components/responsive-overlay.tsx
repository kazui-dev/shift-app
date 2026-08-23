import { X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
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
}

function DrawerView({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ResponsiveOverlayProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerContent className={cn("max-h-[85dvh]", className)}>
        <DrawerHeader className="border-b px-5 pb-4 text-left">
          <DrawerTitle className="pr-10">{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <DrawerClose
          className="absolute top-4 right-3"
          render={<Button variant="ghost" size="icon-sm" aria-label="閉じる" />}
        >
          <X />
        </DrawerClose>
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
      <DialogContent className={cn("gap-0 p-0", props.className)}>
        <DialogHeader className="border-b p-5 pr-14">
          <DialogTitle>{props.title}</DialogTitle>
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
        className={cn("w-[28rem] max-w-full gap-0", props.className)}
        side="right"
      >
        <SheetHeader className="border-b px-6 py-5 pr-14">
          <SheetTitle>{props.title}</SheetTitle>
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

import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "@workspace/ui/lib/utils"

export const Popover = PopoverPrimitive.Root

export function PopoverContent({
  anchor,
  className,
  children,
  ...props
}: PopoverPrimitive.Popup.Props & {
  anchor: PopoverPrimitive.Positioner.Props["anchor"]
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        anchor={anchor}
        align="start"
        sideOffset={10}
        collisionPadding={16}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "w-91 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none",
            className
          )}
          {...props}
        >
          <PopoverPrimitive.Arrow
            data-slot="popover-arrow"
            aria-hidden="true"
            className="size-3 rotate-45 bg-popover data-[side=bottom]:-top-[7px] data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=left]:-right-[7px] data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:-left-[7px] data-[side=right]:border-b data-[side=right]:border-l data-[side=top]:-bottom-[7px] data-[side=top]:border-r data-[side=top]:border-b"
          />
          <div className="max-h-(--available-height) overflow-y-auto p-5">
            {children}
          </div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

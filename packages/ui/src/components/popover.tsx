import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "@workspace/ui/lib/utils"

export const Popover = PopoverPrimitive.Root

const ARROW_HEIGHT = 14
const ARROW_WIDTH = 20
const ARROW_GAP = 4
const POPUP_BORDER = 1

export function PopoverContent({
  anchor,
  className,
  children,
  side = "bottom",
  align = "start",
  bodyClassName,
  collisionAvoidance,
  ...props
}: PopoverPrimitive.Popup.Props & {
  anchor: PopoverPrimitive.Positioner.Props["anchor"]
  side?: PopoverPrimitive.Positioner.Props["side"]
  align?: PopoverPrimitive.Positioner.Props["align"]
  collisionAvoidance?: PopoverPrimitive.Positioner.Props["collisionAvoidance"]
  bodyClassName?: string
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        anchor={anchor}
        align={align}
        side={side}
        collisionAvoidance={collisionAvoidance}
        positionMethod="fixed"
        sideOffset={ARROW_HEIGHT + ARROW_GAP - POPUP_BORDER}
        collisionPadding={16}
        arrowPadding={16}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "relative w-91 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none",
            className
          )}
          {...props}
        >
          <PopoverPrimitive.Arrow
            data-slot="popover-arrow"
            aria-hidden="true"
            className="pointer-events-none block overflow-clip"
            style={({ side: resolvedSide }) => ({
              width: ARROW_WIDTH,
              height: ARROW_HEIGHT,
              ...(resolvedSide === "bottom" && { top: -ARROW_HEIGHT }),
              ...(resolvedSide === "top" && {
                bottom: -ARROW_HEIGHT,
                rotate: "180deg",
              }),
              ...(resolvedSide === "left" && {
                right: -(ARROW_WIDTH + ARROW_HEIGHT) / 2,
                rotate: "90deg",
              }),
              ...(resolvedSide === "right" && {
                left: -(ARROW_WIDTH + ARROW_HEIGHT) / 2,
                rotate: "-90deg",
              }),
            })}
          >
            <span
              className="absolute bottom-0 left-1/2 border bg-popover"
              style={{
                width: ARROW_HEIGHT * Math.SQRT2,
                height: ARROW_HEIGHT * Math.SQRT2,
                transform: `translate(-50%, 50%) scaleX(${ARROW_WIDTH / (ARROW_HEIGHT * 2)}) rotate(45deg)`,
              }}
            />
          </PopoverPrimitive.Arrow>
          <div
            className={cn(
              "max-h-(--available-height) overflow-y-auto p-5",
              bodyClassName
            )}
          >
            {children}
          </div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

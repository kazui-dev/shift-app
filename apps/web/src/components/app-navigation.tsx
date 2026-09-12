import { Link } from "@tanstack/react-router"
import { CalendarDays, MessageCircle, Settings, Users } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

const navigation = [
  { to: "/calendar", label: "カレンダー", icon: CalendarDays },
  { to: "/chat", label: "チャット", icon: MessageCircle },
  { to: "/manage", label: "管理", icon: Users },
  { to: "/settings", label: "設定", icon: Settings },
] as const

const hintClass =
  "hidden border bg-popover text-popover-foreground shadow-md md:inline-flex [&>[aria-hidden=true]]:hidden data-open:animate-none data-closed:animate-none transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"

export function AppNavigation({
  offline,
  desktopOnly,
}: {
  offline: boolean
  desktopOnly: boolean
}) {
  return (
    <TooltipProvider delay={0}>
      <nav
        aria-label="メインナビゲーション"
        className={`${desktopOnly ? "hidden md:flex" : ""} fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:inset-y-0 md:right-auto md:left-0 md:flex md:w-(--app-sidebar-width) md:flex-col md:border-t-0 md:border-r md:bg-background md:px-2 md:py-3 md:backdrop-blur-none`}
      >
        <div
          id="app-navigation-items"
          className="flex px-1 md:min-h-0 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:px-0"
        >
          <NavigationItems offline={offline} />
        </div>
      </nav>
    </TooltipProvider>
  )
}

export function BottomNavigation({ offline }: { offline: boolean }) {
  return (
    <TooltipProvider delay={0}>
      <nav
        aria-label="メインナビゲーション"
        className="shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex px-1">
          <NavigationItems offline={offline} />
        </div>
      </nav>
    </TooltipProvider>
  )
}
function NavigationItems({ offline }: { offline: boolean }) {
  const items = offline
    ? navigation.filter((item) => item.to !== "/manage")
    : navigation
  return (
    <>
      {items.map(({ to, label, icon: Icon }) => (
        <Tooltip key={to}>
          <TooltipTrigger
            render={
              <Link
                to={to}
                preload="render"
                aria-label={label}
                className={`flex min-h-[calc(var(--app-bottom-bar-height)-1px)] min-w-0 flex-1 items-center justify-center overflow-hidden py-2 text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] md:min-h-12 md:flex-none md:justify-start md:rounded-lg md:py-0 md:hover:bg-muted ${to === "/settings" ? "md:mt-auto" : ""}`}
                activeProps={{
                  className:
                    "text-foreground md:bg-muted md:font-medium [&_svg]:stroke-[2.5] [&_[data-nav-icon]]:bg-muted md:[&_[data-nav-icon]]:bg-transparent",
                }}
              />
            }
          >
            <span className="flex shrink-0 flex-col items-center gap-1 md:gap-0">
              <span
                data-nav-icon
                className="flex h-8 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none md:size-12"
              >
                <Icon className="size-5" />
              </span>
              <span className="text-[11px] leading-3.5 font-medium whitespace-nowrap md:hidden">
                {label}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className={hintClass}>
            {label}
          </TooltipContent>
        </Tooltip>
      ))}
    </>
  )
}

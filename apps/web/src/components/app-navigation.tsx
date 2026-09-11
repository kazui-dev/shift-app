import { Link } from "@tanstack/react-router"
import {
  CalendarDays,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react"
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
  expanded,
  onToggle,
}: {
  offline: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const items = offline
    ? navigation.filter((item) => item.to !== "/manage")
    : navigation
  const toggleLabel = expanded ? "サイドバーを閉じる" : "サイドバーを開く"
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen

  return (
    <TooltipProvider delay={0}>
      <nav
        aria-label="メインナビゲーション"
        data-expanded={expanded}
        className="group/nav fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-[width] duration-200 ease-linear motion-reduce:transition-none md:inset-y-0 md:right-auto md:left-0 md:flex md:w-(--app-sidebar-width) md:flex-col md:border-t-0 md:border-r md:bg-background md:px-2 md:py-4 md:backdrop-blur-none"
      >
        <div className="mb-4 hidden md:block">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={toggleLabel}
                  aria-expanded={expanded}
                  aria-controls="app-navigation-items"
                  onClick={onToggle}
                  className="flex size-12 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                />
              }
            >
              <ToggleIcon className="size-5" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className={hintClass}>
              {toggleLabel}
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          id="app-navigation-items"
          className="flex px-1 md:min-h-0 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:px-0"
        >
          {items.map(({ to, label, icon: Icon }) => (
            <Tooltip key={to} disabled={expanded}>
              <TooltipTrigger
                render={
                  <Link
                    to={to}
                    preload="render"
                    aria-label={label}
                    className={`flex min-h-16 min-w-0 flex-1 items-center justify-center overflow-hidden text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] md:min-h-12 md:flex-none md:justify-start md:rounded-lg md:hover:bg-muted ${to === "/settings" ? "md:mt-auto" : ""}`}
                    activeProps={{
                      className:
                        "text-foreground md:bg-muted md:font-medium [&_svg]:stroke-[2.5]",
                    }}
                  />
                }
              >
                <span className="flex shrink-0 items-center md:w-48">
                  <span className="flex shrink-0 items-center justify-center md:size-12">
                    <Icon className="size-5" />
                  </span>
                  <span className="sr-only whitespace-nowrap md:not-sr-only md:pr-3 md:text-sm">
                    {label}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className={hintClass}>
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </nav>
    </TooltipProvider>
  )
}

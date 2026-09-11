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
  hiddenOnMobile,
  expanded,
  onToggle,
}: {
  offline: boolean
  hiddenOnMobile: boolean
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
        inert={hiddenOnMobile}
        data-hidden={hiddenOnMobile}
        className="group/nav fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-[width,translate,opacity] duration-200 ease-out data-[hidden=true]:translate-y-full data-[hidden=true]:opacity-0 motion-reduce:transition-none md:inset-y-0 md:right-auto md:left-0 md:flex md:w-(--app-sidebar-width) md:flex-col md:border-t-0 md:border-r md:bg-background md:px-2 md:py-4 md:backdrop-blur-none"
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
                    className={`flex min-h-14 min-w-0 flex-1 items-center justify-center overflow-hidden py-1.5 text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] md:min-h-12 md:flex-none md:justify-start md:rounded-lg md:py-0 md:hover:bg-muted ${to === "/settings" ? "md:mt-auto" : ""}`}
                    activeProps={{
                      className:
                        "text-foreground md:bg-muted md:font-medium [&_svg]:stroke-[2.5] [&_[data-nav-icon]]:bg-muted md:[&_[data-nav-icon]]:bg-transparent",
                    }}
                  />
                }
              >
                <span className="flex shrink-0 flex-col items-center gap-0.5 md:w-48 md:flex-row md:gap-0">
                  <span
                    data-nav-icon
                    className="flex h-7 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none md:size-12"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-[11px] leading-3.5 font-medium whitespace-nowrap md:pr-3 md:text-sm md:font-normal">
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

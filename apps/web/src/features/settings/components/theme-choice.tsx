import { Monitor, Moon, Smartphone, Sun } from "lucide-react"

import { useTheme } from "@/app/theme-context"

/** 自動 follows the device, so it shows the shape of the one in hand. */
function DeviceIcon({ className }: { className?: string }) {
  return (
    <>
      <Smartphone className={`${className} md:hidden`} />
      <Monitor className={`${className} hidden md:block`} />
    </>
  )
}

const choices = [
  { value: "system", label: "自動", icon: DeviceIcon },
  { value: "light", label: "ライト", icon: Sun },
  { value: "dark", label: "ダーク", icon: Moon },
] as const

/** The three themes as one segmented control, the current one filled in. */
export function ThemeChoice() {
  const { theme, setTheme } = useTheme()
  return (
    <fieldset
      className="flex gap-0.5 rounded-lg bg-muted p-0.5"
      aria-label="テーマ"
    >
      {choices.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
            theme === value
              ? "bg-background font-medium text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </fieldset>
  )
}

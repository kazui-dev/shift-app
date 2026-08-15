import { Link, Outlet, useRouter } from "@tanstack/react-router"
import {
  Bell,
  CalendarDays,
  ClipboardList,
  LogOut,
  Settings,
  Users,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import type { AuthState } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"

const navigation = [
  { to: "/timeline", label: "タイムライン", icon: CalendarDays },
  { to: "/availability", label: "希望提出", icon: ClipboardList },
  { to: "/notices", label: "連絡", icon: Bell },
  { to: "/manage", label: "シフト管理", icon: Users },
] as const

export function AppShell({
  state,
}: {
  state: Extract<AuthState, { status: "active" }>
}) {
  const queryClient = useQueryClient()
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    await router.navigate({ to: "/" })
  }

  return (
    <div className="mx-auto min-h-svh max-w-5xl px-4 py-5 pb-24">
      <header className="mb-6 flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs text-muted-foreground">旭祭実行委員会</p>
          <p className="font-medium">{state.member.displayName}さん</p>
        </div>
        <div className="flex gap-1">
          {state.member.accessLevel === "system_admin" && (
            <Button asChild size="icon-sm" variant="ghost">
              <Link to="/system" aria-label="システム管理">
                <Settings />
              </Link>
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={signOut}>
            <LogOut />
            <span className="sr-only">ログアウト</span>
          </Button>
        </div>
      </header>

      <Outlet />

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 px-2 py-3 text-xs text-muted-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

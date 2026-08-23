import { useCallback, useEffect } from "react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useRouter } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { AuthShell } from "@/components/auth-shell"
import { OfflineAccountUnavailableError } from "@/lib/account-state"

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const offline = error instanceof OfflineAccountUnavailableError
  const router = useRouter()
  const retry = useCallback(() => {
    reset()
    void router.invalidate()
  }, [reset, router])

  useEffect(() => {
    if (!offline) return undefined
    const retryWhenOnline = () => {
      if (navigator.onLine) retry()
    }
    const timer = window.setInterval(retryWhenOnline, 10_000)
    window.addEventListener("online", retryWhenOnline)
    window.addEventListener("focus", retryWhenOnline)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("online", retryWhenOnline)
      window.removeEventListener("focus", retryWhenOnline)
    }
  }, [offline, retry])

  if (offline) {
    return (
      <AuthShell>
        <div className="text-center">
          <img
            className="mx-auto mb-10 h-36 w-auto sm:h-40"
            src="/kuruton-login.png"
            alt=""
          />
          <h1 className="text-xl font-semibold tracking-tight">
            インターネットに接続してください
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            オンラインになると自動で再開します
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">読み込みに失敗しました</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          通信状態を確認して、もう一度お試しください。
        </p>
        <Button onClick={retry}>再読み込み</Button>
      </div>
    </AuthShell>
  )
}

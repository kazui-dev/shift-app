import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, LogOut } from "lucide-react"
import { z } from "zod"

import {
  authStateSchema,
  onboardingInputSchema,
  type AuthState,
} from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { AdminPanel } from "@/components/admin-panel"
import { authClient } from "@/lib/auth-client"

const healthSchema = z.object({
  ok: z.literal(true),
  database: z.literal("ready"),
  timestamp: z.string().datetime(),
})

async function getAuthState() {
  const response = await fetch("/api/auth-state", { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Auth API returned ${response.status}`)
  }

  return authStateSchema.parse(await response.json())
}

async function getHealth() {
  const response = await fetch("/api/health")
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }

  return healthSchema.parse(await response.json())
}

function PageShell({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <main
      className={`mx-auto flex min-h-svh items-center p-6 ${wide ? "max-w-5xl" : "max-w-md"}`}
    >
      <div className="flex w-full min-w-0 flex-col gap-5 text-sm leading-loose">
        {children}
      </div>
    </main>
  )
}

function LoginView({ providers }: { providers: { discord: boolean } }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setPending(true)
    setError(null)

    const result = await authClient.signIn.social({
      provider: "discord",
      callbackURL: "/",
      newUserCallbackURL: "/",
      errorCallbackURL: "/",
    })

    if (result.error) {
      setError("ログインを開始できませんでした。設定を確認してください。")
      setPending(false)
    }
  }

  return (
    <PageShell>
      <div className="text-center">
        <p className="text-muted-foreground">旭祭実行委員会</p>
        <h1 className="text-2xl font-medium">シフト管理アプリ</h1>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          disabled={!providers.discord || pending}
          onClick={signIn}
        >
          {pending && <LoaderCircle className="animate-spin" />}
          Discordで続ける
        </Button>
      </div>

      {!providers.discord && (
        <p className="text-center text-xs text-muted-foreground">
          ローカルのOAuth credentialが未設定です。
        </p>
      )}
      {error && <p className="text-center text-destructive">{error}</p>}
    </PageShell>
  )
}

function OnboardingView() {
  const queryClient = useQueryClient()
  const [studentId, setStudentId] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed = onboardingInputSchema.safeParse({ studentId, displayName })
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "入力内容を確認してください。"
      )
      return
    }

    setPending(true)
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    })

    if (response.ok) {
      await queryClient.invalidateQueries({ queryKey: ["auth-state"] })
      setPending(false)
      return
    }

    setError(
      response.status === 409
        ? "この学籍番号のアカウントは登録済みです。連携申請を作成しました。既存のDiscord accountでログインするか、システム管理者へ連絡してください。"
        : "アカウントを作成できませんでした。もう一度お試しください。"
    )
    setPending(false)
  }

  async function signOut() {
    await authClient.signOut()
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] })
  }

  return (
    <PageShell>
      <div>
        <p className="text-muted-foreground">初回登録</p>
        <h1 className="text-xl font-medium">アカウントを作成</h1>
        <p className="mt-2 text-muted-foreground">
          学籍番号と名前はシフトアプリ内で管理します。
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">学籍番号</span>
          <input
            className="h-10 rounded-md border bg-background px-3 font-mono outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            autoComplete="username"
            inputMode="text"
            placeholder="26AJ112"
            required
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">名前</span>
          <input
            className="h-10 rounded-md border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            autoComplete="name"
            maxLength={80}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        {error && <p className="text-destructive">{error}</p>}

        <Button size="lg" type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          アカウントを作成
        </Button>
      </form>

      <Button variant="ghost" onClick={signOut}>
        <LogOut />
        ログイン画面に戻る
      </Button>
    </PageShell>
  )
}

function ActiveView({
  state,
}: {
  state: Extract<AuthState, { status: "active" }>
}) {
  const queryClient = useQueryClient()
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  })
  async function signOut() {
    await authClient.signOut()
    queryClient.removeQueries({ queryKey: ["auth-state"] })
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] })
  }

  return (
    <PageShell wide={state.member.accessLevel === "system_admin"}>
      <div>
        <p className="text-muted-foreground">旭祭実行委員会</p>
        <h1 className="text-xl font-medium">{state.member.displayName}さん</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {state.member.studentId} · {state.member.accessLevel}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="font-medium">環境ステータス</p>
        {health.isPending && <p>APIを確認しています…</p>}
        {health.isError && (
          <div className="space-y-2">
            <p className="text-destructive">APIに接続できません。</p>
            <Button size="sm" onClick={() => health.refetch()}>
              再試行
            </Button>
          </div>
        )}
        {health.data && <p className="text-muted-foreground">API / D1: 正常</p>}
      </div>

      {state.member.accessLevel === "system_admin" && <AdminPanel />}

      <Button variant="ghost" onClick={signOut}>
        <LogOut />
        ログアウト
      </Button>
    </PageShell>
  )
}

export function IndexPage() {
  const authState = useQuery({
    queryKey: ["auth-state"],
    queryFn: getAuthState,
    retry: false,
    meta: { persist: false },
  })

  if (authState.isPending) {
    return (
      <PageShell>
        <LoaderCircle className="mx-auto animate-spin text-muted-foreground" />
      </PageShell>
    )
  }

  if (authState.isError) {
    return (
      <PageShell>
        <p className="text-center text-destructive">
          認証状態を確認できませんでした。
        </p>
        <Button onClick={() => authState.refetch()}>再試行</Button>
      </PageShell>
    )
  }

  if (authState.data.status === "anonymous") {
    return <LoginView providers={authState.data.providers} />
  }

  if (authState.data.status === "onboarding") {
    return <OnboardingView />
  }

  return <ActiveView state={authState.data} />
}

import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, LogOut } from "lucide-react"
import * as v from "valibot"

import { onboardingInputSchema } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { createAccount } from "@/api/account"
import { ApiError } from "@/api/client"
import { authClient } from "@/lib/auth-client"
import { accountStateQueryOptions } from "@/lib/account-state"

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center p-6">
      <div className="flex w-full min-w-0 flex-col gap-5 text-sm leading-loose">
        {children}
      </div>
    </main>
  )
}

function LoginView({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setPending(true)
    setError(null)
    const result = await authClient.signIn.social({
      provider: "discord",
      callbackURL: "/timeline",
      newUserCallbackURL: "/",
      errorCallbackURL: "/",
    })
    if (result.error) {
      setError("ログインを開始できませんでした。")
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <div className="text-center">
        <p className="text-muted-foreground">旭祭実行委員会</p>
        <h1 className="text-2xl font-medium">シフト管理アプリ</h1>
      </div>
      <Button size="lg" disabled={!enabled || pending} onClick={signIn}>
        {pending && <LoaderCircle className="animate-spin" />}
        Discordで続ける
      </Button>
      {!enabled && (
        <p className="text-center text-xs text-muted-foreground">
          OAuth credentialが未設定です。
        </p>
      )}
      {error && <p className="text-center text-destructive">{error}</p>}
    </AuthShell>
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
    const parsed = v.safeParse(onboardingInputSchema, {
      studentId,
      displayName,
    })
    if (!parsed.success) {
      setError(parsed.issues[0]?.message ?? "入力内容を確認してください。")
      return
    }

    setPending(true)
    setError(null)
    try {
      await createAccount(parsed.output)
      await queryClient.invalidateQueries({ queryKey: ["account"] })
      window.location.assign("/timeline")
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? "この学籍番号は登録済みです。連携申請を作成したため、管理者へ連絡してください。"
          : "アカウントを作成できませんでした。"
      )
      setPending(false)
    }
  }

  async function signOut() {
    await authClient.signOut()
    await queryClient.invalidateQueries({ queryKey: ["account"] })
  }

  return (
    <AuthShell>
      <div>
        <p className="text-muted-foreground">初回登録</p>
        <h1 className="text-xl font-medium">アカウントを作成</h1>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">学籍番号</span>
          <input
            className="h-10 rounded-md border bg-background px-3 font-mono"
            placeholder="26AJ112"
            required
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">名前</span>
          <input
            className="h-10 rounded-md border bg-background px-3"
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
    </AuthShell>
  )
}

export function AuthPage() {
  const authState = useQuery(accountStateQueryOptions)
  if (authState.isPending) {
    return (
      <AuthShell>
        <LoaderCircle className="mx-auto animate-spin" />
      </AuthShell>
    )
  }
  if (authState.isError) {
    return (
      <AuthShell>
        <p className="text-destructive">認証状態を確認できませんでした。</p>
        <Button onClick={() => authState.refetch()}>再試行</Button>
      </AuthShell>
    )
  }
  if (authState.data.status === "anonymous") {
    return <LoginView enabled={authState.data.providers.discord} />
  }
  if (authState.data.status === "onboarding") {
    return <OnboardingView />
  }
  return null
}

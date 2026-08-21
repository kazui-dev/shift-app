import { useState, type ComponentProps, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, LogOut, RotateCcw, X } from "lucide-react"
import * as v from "valibot"

import { onboardingInputSchema } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"

import { createAccount } from "@/api/account"
import { ApiError } from "@/api/client"
import { authClient } from "@/lib/auth-client"
import { accountStateQueryOptions } from "@/lib/account-state"

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="flex w-full max-w-sm min-w-0 flex-col gap-6 rounded-2xl border bg-card px-6 py-8 text-sm leading-relaxed text-card-foreground shadow-sm sm:px-8">
        {children}
      </section>
    </main>
  )
}

function DiscordIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M40.575 0C39.9562 1.09866 39.4006 2.2352 38.8954 3.397C34.0967 2.67719 29.2096 2.67719 24.3982 3.397C23.9057 2.2352 23.3374 1.09866 22.7186 0C18.2104 0.770324 13.8157 2.12155 9.64839 4.02841C1.38951 16.2652 -0.845688 28.1863 0.265599 39.9432C5.10222 43.517 10.5197 46.2447 16.2909 47.9874C17.5916 46.2447 18.7407 44.3883 19.7257 42.4562C17.8568 41.7616 16.0509 40.8903 14.3208 39.88C14.7755 39.5517 15.2175 39.2107 15.6468 38.8824C25.7873 43.6559 37.5316 43.6559 47.6847 38.8824C48.1141 39.236 48.5561 39.577 49.0107 39.88C47.2806 40.9029 45.4748 41.7616 43.5931 42.4688C44.5781 44.4009 45.7273 46.2573 47.028 48C52.7991 46.2573 58.2167 43.5422 63.0533 39.9684C64.3666 26.3299 60.8055 14.5099 53.6452 4.04104C49.4905 2.13418 45.0959 0.782952 40.5876 0.0252565L40.575 0ZM21.1401 32.7072C18.0209 32.7072 15.4321 29.8785 15.4321 26.3804C15.4321 22.8824 17.9199 20.041 21.1275 20.041C24.3351 20.041 26.886 22.895 26.8354 26.3804C26.7849 29.8658 24.3224 32.7072 21.1401 32.7072ZM42.1788 32.7072C39.047 32.7072 36.4834 29.8785 36.4834 26.3804C36.4834 22.8824 38.9712 20.041 42.1788 20.041C45.3864 20.041 47.9246 22.895 47.8741 26.3804C47.8236 29.8658 45.3611 32.7072 42.1788 32.7072Z"
      />
    </svg>
  )
}

function FloatingAlert({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-start gap-3 rounded-lg border border-destructive/30 bg-popover px-4 py-3 text-popover-foreground shadow-lg"
      role="alert"
    >
      <p className="min-w-0 flex-1 text-sm leading-relaxed">{message}</p>
      <button
        className="mt-0.5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        type="button"
        aria-label="通知を閉じる"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
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
        <img
          className="mx-auto mb-10 h-36 w-auto sm:h-40"
          src="/kuruton-login.png"
          alt=""
        />
        <h1 className="text-2xl font-semibold tracking-tight">旭祭シフト</h1>
      </div>
      <Button
        className={
          error
            ? "h-11 w-full bg-destructive text-white shadow-xs hover:bg-destructive/90"
            : "h-11 w-full bg-[#5865f2] text-white hover:bg-[#4752c4]"
        }
        size="lg"
        disabled={!enabled || pending}
        aria-busy={pending}
        aria-label={
          error ? "ログインできませんでした。もう一度ログイン" : undefined
        }
        onClick={signIn}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : error ? (
          <RotateCcw />
        ) : (
          <DiscordIcon className="size-5" />
        )}
        {pending
          ? "Discordを開いています"
          : error
            ? "もう一度ログイン"
            : "Discordで続ける"}
      </Button>
      {!enabled && (
        <output className="text-center text-xs text-muted-foreground">
          現在ログインを利用できません。
        </output>
      )}
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
        <Button size="lg" type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          アカウントを作成
        </Button>
      </form>
      <Button variant="ghost" onClick={signOut}>
        <LogOut />
        ログイン画面に戻る
      </Button>
      {error && (
        <FloatingAlert message={error} onDismiss={() => setError(null)} />
      )}
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

import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { LoaderCircle } from "lucide-react"
import * as v from "valibot"

import {
  onboardingInputSchema,
  type OnboardingInput,
} from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { ApiError } from "@/api/client"
import { keys } from "@/data/keys"
import { AuthShell } from "@/components/auth-shell"

/** The message for a registration the server refused. */
function failureMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.status === 409) {
      return "この学籍番号はすでに使われています。本人確認を依頼しました。管理者へ連絡してください。"
    }
    // The demo roster and input checks already answer in the member's words.
    if (caught.status === 400 || caught.status === 403) return caught.message
  }
  return "登録できませんでした。もう一度お試しください。"
}

/**
 * The student ID and name a new member registers with. `register` performs the
 * sign-in the current mode needs before the account is created.
 */
export function OnboardingForm({
  description,
  register,
}: {
  description?: string
  register: (input: OnboardingInput) => Promise<void>
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [studentId, setStudentId] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = v.safeParse(onboardingInputSchema, {
      studentId,
      displayName,
    })
    if (!parsed.success) {
      toast.error(parsed.issues[0]?.message ?? "入力内容を確認してください。")
      return
    }

    setPending(true)
    try {
      await register(parsed.output)
      await queryClient.invalidateQueries({ queryKey: keys.account() })
      await navigate({ to: "/calendar", replace: true })
    } catch (caught) {
      toast.error(failureMessage(caught))
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-center text-xl font-medium">新規登録</h1>
      {description && (
        <p className="text-center text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="student-id">学籍番号（英字大文字）</FieldLabel>
            <Input
              id="student-id"
              className="h-11 font-mono"
              placeholder="26AJ000"
              required
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="display-name">氏名（スペースなし）</FieldLabel>
            <Input
              id="display-name"
              className="h-11"
              maxLength={80}
              placeholder="電大太郎"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <Button size="lg" type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          登録する
        </Button>
      </form>
    </AuthShell>
  )
}

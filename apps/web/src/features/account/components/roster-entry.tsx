import { useState, type FormEvent } from "react"
import { LoaderCircle } from "lucide-react"
import * as v from "valibot"

import { onboardingInputSchema } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import { signInFromDirectory } from "@/features/account/api/account"
import { ApiError, errorMessage } from "@/lib/http/client"
import { AuthShell } from "@/app/auth-shell"
import { AuthHeading } from "@/features/account/components/auth-heading"

/**
 * The entry screen while Discord OAuth is off. The student ID and name are
 * checked against the year's directory; both must match.
 */
export function RosterEntry({
  onEntered,
}: {
  onEntered: (created: boolean) => void
}) {
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
      onEntered(await signInFromDirectory(parsed.output))
    } catch (caught) {
      toast.error(
        caught instanceof ApiError && caught.status < 500
          ? caught.message
          : errorMessage(caught)
      )
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <AuthHeading />
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
        <Button
          className="mt-2 h-11"
          size="lg"
          type="submit"
          disabled={pending}
        >
          {pending && <LoaderCircle className="animate-spin" />}
          送信
        </Button>
      </form>
    </AuthShell>
  )
}

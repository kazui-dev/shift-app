import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { createAccount } from "@/features/account/api/account"
import { keys } from "@/app/data/keys"
import { accountStateQueryOptions } from "@/features/account/lib/state"
import { AuthShell } from "@/app/auth-shell"
import { AvatarStep } from "@/features/account/components/avatar-step"
import { DiscordLogin } from "@/features/account/components/discord-login"
import { OnboardingForm } from "@/features/account/components/onboarding-form"
import { RosterEntry } from "@/features/account/components/roster-entry"

export function AuthPage() {
  const authState = useQuery(accountStateQueryOptions)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // A member the directory has just created is offered a profile image before
  // the app opens; the account query is refreshed once that step is done.
  const [entered, setEntered] = useState(false)

  async function open() {
    await queryClient.invalidateQueries({ queryKey: keys.account() })
    await navigate({ to: "/calendar", replace: true })
  }

  if (entered) {
    return <AvatarStep onDone={open} />
  }
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
    if (!authState.data.providers.roster) {
      return <DiscordLogin enabled={authState.data.providers.discord} />
    }
    return (
      <RosterEntry
        onEntered={(created) => {
          if (created) setEntered(true)
          else void open()
        }}
      />
    )
  }
  if (authState.data.status === "onboarding") {
    return (
      <OnboardingForm
        register={async (input) => {
          await createAccount(input)
        }}
      />
    )
  }
  return null
}

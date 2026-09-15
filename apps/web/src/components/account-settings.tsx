import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { removeAvatar, uploadAvatar } from "@/api/account"
import { errorMessage } from "@/api/client"
import { keys } from "@/data/keys"
import { accountStateQueryOptions } from "@/lib/account/state"
import { AvatarField } from "@/components/avatar-field"
import { useOfflineMode } from "@/components/offline-mode-context"

/** The member's own account: their icon, and the details the directory fixes. */
export function AccountSettings() {
  const offline = useOfflineMode()
  const client = useQueryClient()
  const account = useQuery(accountStateQueryOptions)
  const [pending, setPending] = useState(false)
  const member =
    account.data?.status === "active" ? account.data.member : undefined

  async function run(work: () => Promise<unknown>) {
    if (pending) return
    setPending(true)
    try {
      await work()
      await client.invalidateQueries({ queryKey: keys.account() })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  if (!member) return null
  return (
    <div className="space-y-3 border-y px-4 py-4 sm:px-6">
      <AvatarField
        name={member.displayName}
        image={member.image}
        file={null}
        pending={pending || offline}
        onPick={(file) => void run(() => uploadAvatar(file))}
      >
        {member.image && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending || offline}
            onClick={() => void run(removeAvatar)}
          >
            削除
          </Button>
        )}
      </AvatarField>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">氏名</dt>
        <dd className="min-w-0 truncate">{member.displayName}</dd>
        <dt className="text-muted-foreground">学籍番号</dt>
        <dd className="font-mono">{member.studentId}</dd>
      </dl>
    </div>
  )
}

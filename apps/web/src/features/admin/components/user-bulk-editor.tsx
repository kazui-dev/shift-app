import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { AdminUser } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { SearchableList } from "@/components/searchable-list"
import { SelectField } from "@/components/select-field"
import { keys } from "@/app/data/keys"
import { errorMessage } from "@/lib/http/client"
import {
  activateYearMembership,
  deactivateYearMembership,
  updateAdminAccessLevel,
} from "../api/admin"
import { accessLevelLabels } from "../access-levels"

type Change = { key: string; label: string; run: () => Promise<unknown> }
export function UserBulkEditor({
  kind,
  users,
  years,
  onDirtyChange,
  onPendingChange,
  onClose,
  onApplied,
}: {
  kind: "years" | "access"
  users: AdminUser[]
  years: number[]
  onPendingChange?: ((pending: boolean) => void) | undefined
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  onApplied: () => void
}) {
  const client = useQueryClient()
  const [yearChanges, setYearChanges] = useState<Record<string, string>>({})
  const [level, setLevel] = useState<AdminUser["accessLevel"] | "keep">("keep")
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  useEffect(() => {
    onPendingChange?.(pending)
    return () => onPendingChange?.(false)
  }, [pending, onPendingChange])
  const saving = useRef(false)
  const [discarding, setDiscarding] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [failures, setFailures] = useState<
    { key: string; label: string; message: string }[]
  >([])
  const changes: Change[] =
    kind === "years"
      ? users.flatMap((user) =>
          years.flatMap((year) => {
            const action = yearChanges[String(year)]
            if (
              (action !== "add" || user.years.includes(year)) &&
              (action !== "remove" || !user.years.includes(year))
            )
              return []
            return [
              {
                key: `${user.id}:${year}`,
                label: `${user.displayName}・${year}年度`,
                run: () =>
                  action === "add"
                    ? activateYearMembership(year, user.id)
                    : deactivateYearMembership(year, user.id),
              },
            ]
          })
        )
      : users.flatMap((user) => {
          if (
            level === "keep" ||
            user.isCurrentUser ||
            level === user.accessLevel
          )
            return []
          const accessLevel = level
          return [
            {
              key: user.id,
              label: user.displayName,
              run: () =>
                updateAdminAccessLevel(user.id, {
                  accessLevel,
                  reason: reason.trim(),
                }),
            },
          ]
        })
  const remaining = changes.filter((change) => !completed.has(change.key))
  const dirty = remaining.length > 0
  const locked = pending || completed.size > 0
  useEffect(() => {
    onDirtyChange(dirty || pending)
    return () => onDirtyChange(false)
  }, [dirty, pending, onDirtyChange])
  function close() {
    if (pending) return
    if (dirty) setDiscarding(true)
    else onClose()
  }
  async function apply() {
    if (saving.current || !dirty || (kind === "access" && !reason.trim()))
      return
    saving.current = true
    setPending(true)
    const queue = [...remaining]
    const done = new Set(completed)
    const failed: typeof failures = []
    await Promise.all(
      Array.from(
        { length: Math.min(4, queue.length) },
        async function applyNext(): Promise<void> {
          const change = queue.shift()
          if (!change) return
          try {
            await change.run()
            done.add(change.key)
          } catch (error) {
            failed.push({
              key: change.key,
              label: change.label,
              message: errorMessage(error),
            })
          }
          await applyNext()
        }
      )
    )
    setCompleted(done)
    setFailures(failed)
    await Promise.allSettled([
      client.invalidateQueries({ queryKey: keys.adminUsers() }),
      client.invalidateQueries({ queryKey: keys.roster() }),
      client.invalidateQueries({ queryKey: keys.years() }),
      client.invalidateQueries({ queryKey: keys.displayYear() }),
    ])
    setPending(false)
    saving.current = false
    if (!failed.length) {
      toast.success(
        kind === "years" ? "参加年度を更新しました。" : "権限を更新しました。"
      )
      onApplied()
    }
  }
  return (
    <>
      <ResponsiveDialog
        open
        title={kind === "years" ? "年度を変更" : "権限を変更"}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {users.length}人選択中
          </p>
          {kind === "years" ? (
            <SearchableList
              label="年度"
              items={years}
              getSearchText={(year) => `${year}年度`}
            >
              {(year) => (
                <div
                  key={year}
                  className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0"
                >
                  <div>
                    <span>{year}年度</span>
                    <p className="text-xs text-muted-foreground">
                      {users.filter((user) => user.years.includes(year)).length}
                      /{users.length}人参加中
                    </p>
                  </div>
                  <SelectField
                    aria-label={`${year}年度の変更`}
                    className="w-auto shrink-0"
                    disabled={locked}
                    value={yearChanges[String(year)] ?? "keep"}
                    onValueChange={(value) =>
                      setYearChanges((current) => ({
                        ...current,
                        [String(year)]: value,
                      }))
                    }
                    options={[
                      { value: "keep", label: "変更しない" },
                      { value: "add", label: "参加" },
                      { value: "remove", label: "参加解除" },
                    ]}
                  />
                </div>
              )}
            </SearchableList>
          ) : (
            <div className="space-y-3">
              {users.some((user) => user.isCurrentUser) && (
                <p className="text-sm text-muted-foreground">
                  自分自身の権限は変更されません。
                </p>
              )}
              <SelectField
                aria-label="システム権限"
                disabled={locked}
                value={level}
                onValueChange={(value) => {
                  if (
                    value === "keep" ||
                    value === "member" ||
                    value === "leader" ||
                    value === "system_admin"
                  )
                    setLevel(value)
                }}
                options={[
                  { value: "keep", label: "変更しない" },
                  ...Object.entries(accessLevelLabels).map(
                    ([value, label]) => ({ value, label })
                  ),
                ]}
              />
              <Input
                maxLength={240}
                aria-label="変更理由"
                placeholder="変更理由"
                disabled={locked}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          )}
          {!!failures.length && (
            <div role="alert" className="space-y-2 text-sm">
              <p>更新できなかった項目だけ再試行できます。</p>
              {failures.map((failure) => (
                <p key={failure.key}>
                  {failure.label}：{failure.message}
                </p>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" disabled={pending} onClick={close}>
              キャンセル
            </Button>
            <Button
              data-save-shortcut
              disabled={
                pending || !dirty || (kind === "access" && !reason.trim())
              }
              onClick={() => void apply()}
            >
              {pending ? "適用中…" : failures.length ? "再試行" : "適用"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
      {discarding && (
        <ConfirmDialog
          title="未適用の変更を破棄しますか"
          confirmLabel="破棄する"
          onCancel={() => setDiscarding(false)}
          onConfirm={onClose}
        />
      )}
    </>
  )
}

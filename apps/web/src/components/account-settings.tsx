import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { toast } from "@workspace/ui/lib/toast"

import { removeAvatar, uploadAvatar } from "@/api/account"
import { errorMessage } from "@/api/client"
import { keys } from "@/data/keys"
import { accountStateQueryOptions } from "@/lib/account/state"
import { AvatarEditor } from "@/components/avatar-editor"
import { useAvatarPicker } from "@/components/avatar-picker"
import { useOfflineMode } from "@/components/offline-mode-context"

/** The member's own account: their icon, and the details the directory fixes. */
export function AccountSettings() {
  const offline = useOfflineMode()
  const client = useQueryClient()
  const account = useQuery(accountStateQueryOptions)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
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

  const picker = useAvatarPicker(setPicked)
  if (!member) return null
  return (
    <div className="flex items-center gap-4 border-y px-4 py-4 sm:px-6">
      {picker.input}
      <button
        type="button"
        disabled={pending || offline}
        aria-label="アイコンを変更"
        onClick={() => setOpen(true)}
        className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-medium text-muted-foreground"
      >
        {pending ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : member.image ? (
          <img src={member.image} alt="" className="size-full object-cover" />
        ) : (
          member.displayName.slice(0, 1)
        )}
      </button>
      <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">氏名</dt>
        <dd className="min-w-0 truncate">{member.displayName}</dd>
        <dt className="text-muted-foreground">学籍番号</dt>
        <dd className="font-mono">{member.studentId}</dd>
      </dl>
      {picked && (
        <AvatarEditor
          file={picked}
          pending={pending}
          onCancel={() => setPicked(null)}
          onDone={(cropped) => {
            setPicked(null)
            void run(() => uploadAvatar(cropped))
          }}
        />
      )}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          finalFocus={false}
          className="pb-[env(safe-area-inset-bottom)]"
        >
          <DrawerTitle className="sr-only">アイコンの操作</DrawerTitle>
          <div className="flex flex-col gap-1 p-3">
            <DrawerClose
              render={<Button variant="ghost" className="h-12 justify-start" />}
              onClick={picker.open}
            >
              <ImagePlus />
              {member.image ? "画像を変更" : "画像を追加"}
            </DrawerClose>
            {member.image && (
              <DrawerClose
                render={
                  <Button
                    variant="ghost"
                    className="h-12 justify-start text-destructive"
                  />
                }
                onClick={() => void run(removeAvatar)}
              >
                <Trash2 />
                画像を削除
              </DrawerClose>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

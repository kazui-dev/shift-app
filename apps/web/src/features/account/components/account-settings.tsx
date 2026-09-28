import { useState } from "react"
import { getRouteApi } from "@tanstack/react-router"
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

import { removeAvatar, uploadAvatar } from "@/features/account/api/account"
import { errorMessage } from "@/lib/http/client"
import { keys } from "@/app/data/keys"
import { accountStateQueryOptions } from "@/features/account/lib/state"
import { AvatarEditor } from "@/features/account/components/avatar-editor"
import { useAvatarPicker } from "@/features/account/components/avatar-picker"
import { useOfflineMode } from "@/app/offline-mode-context"

/** The member's own account: their icon, and the details the directory fixes. */
const route = getRouteApi("/_app")

export function AccountSettings() {
  const offline = useOfflineMode()
  const client = useQueryClient()
  // The account the route resolved is already in hand, so the section draws
  // complete on the first frame and refreshes underneath.
  const { state } = route.useRouteContext()
  const account = useQuery({ ...accountStateQueryOptions, initialData: state })
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const member =
    account.data.status === "active" ? account.data.member : undefined

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
    <>
      <div className="flex items-center gap-4 px-4 py-4">
        {picker.input}
        <button
          type="button"
          disabled={pending || offline}
          aria-label="アイコンを変更"
          onClick={() => setOpen(true)}
          className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-medium text-muted-foreground"
        >
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : member.image ? (
            <img src={member.image} alt="" className="size-full object-cover" />
          ) : (
            member.displayName.slice(0, 1)
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{member.displayName}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {member.studentId}
          </p>
        </div>
      </div>
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
    </>
  )
}

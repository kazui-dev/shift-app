import { ResponsivePageForm } from "@workspace/ui/components/responsive-page-form"
import { keys } from "@/data/keys"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LogOut, Trash2 } from "lucide-react"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { Button } from "@workspace/ui/components/button"
import { ChatNameField } from "@/components/chat/room/name-field"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatTargetOption } from "@workspace/shared/communications"
import {
  saveRoomSettings,
  type getRoomSettings,
  type ChatRoom,
} from "@/api/chat"
import { errorMessage } from "@/api/client"
import { changeRoomMute } from "@/data/preferences"
import { settingsQuery, targetsQuery } from "@/data/chat"
import { RoomGrants } from "@/components/chat/room/grants"

type Actions = { room: ChatRoom; onLeave: () => void; onDelete: () => void }
export function RoomSettings({
  room,
  onClose,
  onLeave,
  onDelete,
}: Actions & { onClose: () => void }) {
  const settings = useQuery({
    ...settingsQuery(room.id),
    enabled: room.canManage,
  })
  const targets = useQuery({
    ...targetsQuery(room.year),
    enabled: room.canManage,
  })
  return (
    <>
      {room.canManage && settings.data && targets.data ? (
        <SettingsEditor
          room={room}
          initial={settings.data}
          targets={targets.data.targets}
          onClose={onClose}
          onLeave={onLeave}
          onDelete={onDelete}
        />
      ) : (
        <>
          <ResponsivePageHeader title="チャット設定" onBack={onClose} />
          <ResponsivePageBody>
            {room.canManage && (settings.isError || targets.isError) && (
              <Button
                variant="ghost"
                onClick={() => {
                  void settings.refetch()
                  void targets.refetch()
                }}
              >
                再試行
              </Button>
            )}
            <NotificationSetting room={room} />
            <RoomActions room={room} onLeave={onLeave} onDelete={onDelete} />
          </ResponsivePageBody>
        </>
      )}
    </>
  )
}

/** The member's own notifications for this room, shown to everyone. */
function NotificationSetting({ room }: { room: ChatRoom }) {
  const client = useQueryClient()
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b py-3">
      <label htmlFor="room-notifications" className="font-medium">
        通知
      </label>
      <Switch
        id="room-notifications"
        checked={!room.muted}
        onCheckedChange={(checked) =>
          void changeRoomMute(client, room.id, !checked).catch((failure) =>
            toast.error(errorMessage(failure))
          )
        }
      />
    </div>
  )
}

function RoomActions({ room, onLeave, onDelete }: Actions) {
  return (
    <div className="space-y-1">
      {room.allowExit && (
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start text-destructive"
          onClick={onLeave}
        >
          <LogOut />
          退出する
        </Button>
      )}
      {room.canManage && (
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start text-destructive"
          onClick={onDelete}
        >
          <Trash2 />
          チャットを削除
        </Button>
      )}
    </div>
  )
}

function SettingsEditor({
  room,
  initial,
  targets,
  onClose,
  onLeave,
  onDelete,
}: Actions & {
  initial: Awaited<ReturnType<typeof getRoomSettings>>
  targets: ChatTargetOption[]
  onClose: () => void
}) {
  const client = useQueryClient()
  const [value, setValue] = useState(initial)
  async function save() {
    await saveRoomSettings(room.id, value)
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.chatRooms() }),
      client.invalidateQueries({ queryKey: keys.chatRoom(room.id) }),
      client.invalidateQueries({ queryKey: keys.chatSettings(room.id) }),
      client.invalidateQueries({ queryKey: keys.chatMembers(room.id) }),
    ])
  }
  return (
    <ResponsivePageForm
      onSave={save}
      onClose={onClose}
      onError={(error) => toast.error(errorMessage(error))}
      closeOnSave={false}
      disabled={!value.name.trim()}
    >
      {(pending) => (
        <>
          <ResponsivePageHeader
            title="チャット設定"
            onBack={onClose}
            backDisabled={pending}
            action={
              <Button
                type="submit"
                size="sm"
                disabled={pending || !value.name.trim()}
              >
                {pending ? "保存中" : "保存"}
              </Button>
            }
          />
          <ResponsivePageBody>
            <fieldset disabled={pending} className="min-w-0 space-y-6">
              <ChatNameField
                id="chat-room-name"
                value={value.name}
                onChange={(name) => setValue({ ...value, name })}
              />
              <label
                htmlFor="chat-room-exit"
                className="flex items-center justify-between gap-4 text-sm"
              >
                メンバーの退出を許可
                <Switch
                  id="chat-room-exit"
                  checked={value.allowExit}
                  onCheckedChange={(allowExit) =>
                    setValue({ ...value, allowExit })
                  }
                />
              </label>
              <RoomGrants
                value={value.targets}
                targets={targets}
                onChange={(grants) => setValue({ ...value, targets: grants })}
              />
              <NotificationSetting room={room} />
              <RoomActions room={room} onLeave={onLeave} onDelete={onDelete} />
            </fieldset>
          </ResponsivePageBody>
        </>
      )}
    </ResponsivePageForm>
  )
}

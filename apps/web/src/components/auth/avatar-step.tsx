import { useState } from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { uploadAvatar } from "@/api/account"
import { errorMessage } from "@/api/client"
import { AuthShell } from "@/components/auth-shell"
import { AvatarField } from "@/components/avatar-field"

/** The optional profile image, offered once the member has been created. */
export function AvatarStep({
  name,
  onDone,
}: {
  name: string
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)

  async function send() {
    if (!file) return
    setPending(true)
    try {
      await uploadAvatar(file)
      onDone()
    } catch (caught) {
      toast.error(errorMessage(caught))
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-center text-xl font-medium">アイコンを設定する</h1>
      <AvatarField
        name={name}
        image={null}
        file={file}
        pending={pending}
        onPick={setFile}
      />
      <div className="flex flex-col gap-2">
        <Button
          className="h-11"
          size="lg"
          disabled={!file || pending}
          onClick={send}
        >
          {pending && <LoaderCircle className="animate-spin" />}
          送信
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          スキップ
        </Button>
      </div>
    </AuthShell>
  )
}

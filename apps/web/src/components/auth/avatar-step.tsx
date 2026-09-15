import { useEffect, useState } from "react"
import { ImagePlus, LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { uploadAvatar } from "@/api/account"
import { errorMessage } from "@/api/client"
import { AuthShell } from "@/components/auth-shell"
import { useAvatarPicker } from "@/components/avatar-picker"

/** The optional profile image, offered once the member has been created. */
export function AvatarStep({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const picker = useAvatarPicker(setFile)

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : null
    setPreview(url)
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  async function confirm() {
    if (!file) {
      onDone()
      return
    }
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
      <div className="flex flex-col items-center gap-3">
        <span className="size-32 overflow-hidden rounded-full bg-muted">
          {preview && (
            <img src={preview} alt="" className="size-full object-cover" />
          )}
        </span>
        {picker.input}
        <button
          type="button"
          disabled={pending}
          onClick={picker.open}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ImagePlus className="size-4" />
          {file ? "画像を変更" : "画像を追加"}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="h-11" size="lg" disabled={pending} onClick={confirm}>
          {pending && <LoaderCircle className="animate-spin" />}
          確定
        </Button>
        <Button
          className="h-11"
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={onDone}
        >
          スキップ
        </Button>
      </div>
    </AuthShell>
  )
}

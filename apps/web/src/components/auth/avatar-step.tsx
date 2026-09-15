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
      <div className="flex justify-center">
        {picker.input}
        <button
          type="button"
          disabled={pending}
          onClick={picker.open}
          className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
        >
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImagePlus className="size-5" />
              画像を追加
            </span>
          )}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="h-11" size="lg" disabled={pending} onClick={confirm}>
          {pending && <LoaderCircle className="animate-spin" />}
          設定
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

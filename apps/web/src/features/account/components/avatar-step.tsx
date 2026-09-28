import { useEffect, useState } from "react"
import { ImagePlus, LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { uploadAvatar } from "@/features/account/api/account"
import { errorMessage } from "@/lib/http/client"
import { AuthShell } from "@/app/auth-shell"
import { AvatarEditor } from "@/features/account/components/avatar-editor"
import { useAvatarPicker } from "@/features/account/components/avatar-picker"

/** The optional profile image, offered once the member has been created. */
export function AvatarStep({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<File | null>(null)
  const [image, setImage] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const picker = useAvatarPicker(setPicked)

  useEffect(() => {
    const url = image ? URL.createObjectURL(image) : null
    setPreview(url)
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [image])

  async function confirm() {
    if (!image) {
      onDone()
      return
    }
    setPending(true)
    try {
      await uploadAvatar(image)
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
      {picked && (
        <AvatarEditor
          file={picked}
          pending={pending}
          onCancel={() => setPicked(null)}
          onDone={(cropped) => {
            setImage(cropped)
            setPicked(null)
          }}
        />
      )}
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

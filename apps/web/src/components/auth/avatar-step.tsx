import { useEffect, useRef, useState } from "react"
import { ImagePlus, LoaderCircle } from "lucide-react"

import { avatarLimits } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { uploadAvatar } from "@/api/account"
import { errorMessage } from "@/api/client"
import { AuthShell } from "@/components/auth-shell"

/** The optional profile image, offered once the member has been created. */
export function AvatarStep({
  name,
  onDone,
}: {
  name: string
  onDone: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : null
    setPreview(url)
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  function choose(chosen: File | undefined) {
    if (!chosen) return
    if (chosen.size > avatarLimits.bytes) {
      toast.error("画像が大きすぎます。別の画像を選んでください。")
      return
    }
    setFile(chosen)
  }

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
      <div className="flex flex-col items-center gap-4">
        <span className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium text-muted-foreground">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            name.slice(0, 1)
          )}
        </span>
        <p className="text-center text-sm text-muted-foreground">
          アイコンを設定できます。あとからでも変更できます。
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          choose(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      <div className="flex flex-col gap-2">
        <Button
          className="h-11"
          size="lg"
          variant="outline"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <ImagePlus className="size-5" />
          {file ? "別の画像を選ぶ" : "画像を選ぶ"}
        </Button>
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

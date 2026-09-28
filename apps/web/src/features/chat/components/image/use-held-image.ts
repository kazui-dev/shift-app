import { useEffect, useEffectEvent, useRef, useState } from "react"
import type { HeldImage } from "@/features/chat/lib/images"

/**
 * One image held for as long as its component shows it. It starts loading
 * once `wanted` or once an `initial` image is shown, and stays held until the
 * component unmounts, so the memory cache never revokes an image on screen.
 */
export function useHeldImage(
  acquire: () => HeldImage<string>,
  wanted: boolean,
  initial: () => string | undefined
) {
  const [src, setSrc] = useState(initial)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const held = useRef<HeldImage<string> | null>(null)
  const start = useEffectEvent(acquire)
  useEffect(
    () => () => {
      held.current?.release()
      held.current = null
    },
    [attempt]
  )
  useEffect(() => {
    if (held.current || (!wanted && !src)) return
    const image = start()
    held.current = image
    setFailed(false)
    void image.promise
      .then((url) => {
        if (held.current === image) setSrc(url)
      })
      .catch(() => {
        if (held.current === image) setFailed(true)
      })
  }, [wanted, src, attempt])
  return {
    src,
    failed,
    /** Loads the image again, as when its URL broke or loading failed. */
    retry: () => {
      setSrc(undefined)
      setAttempt((value) => value + 1)
    },
  }
}

import { useEffect, useEffectEvent, useState } from "react"
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
  const start = useEffectEvent(acquire)
  const request = wanted || src || attempt > 0 ? attempt : null
  useEffect(() => {
    if (request === null) return undefined
    const image = start()
    let active = true
    void image.promise
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      image.release()
    }
  }, [request])
  return {
    src,
    failed,
    /** Loads the image again, as when its URL broke or loading failed. */
    retry: () => {
      setFailed(false)
      setSrc(undefined)
      setAttempt((value) => value + 1)
    },
  }
}

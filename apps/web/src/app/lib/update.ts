type Worker = EventTarget & {
  state: string
  postMessage: (message: { type: string }) => void
}

/** How long the update may make no progress before it counts as lost. */
const idleLimit = 20_000
/** A ceiling for an install that keeps reporting progress but never lands. */
const totalLimit = 120_000
type Registration = EventTarget & {
  waiting: Worker | null
  installing: Worker | null
  update: () => Promise<unknown>
}
type Container = EventTarget & {
  controller: object | null
  getRegistration: () => Promise<Registration | undefined>
}

// Completion means the controller changed, not merely that a message was sent.
export function activateAppUpdate(
  container: Container,
  initialController: object | null,
  signal: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    let registration: Registration | undefined
    let installing: Worker | null = null
    let finished = false
    let idle: ReturnType<typeof setTimeout>
    const lost = () =>
      done(new Error("更新を完了できませんでした。もう一度お試しください。"))
    // A phone on a slow link installs for a while; only a silent stretch, or a
    // wait long past any install, means the update is not coming.
    const progressed = () => {
      clearTimeout(idle)
      idle = setTimeout(lost, idleLimit)
    }
    const cleanup = () => {
      clearTimeout(idle)
      clearTimeout(timer)
      container.removeEventListener("controllerchange", changed)
      signal.removeEventListener("abort", aborted)
      registration?.removeEventListener("updatefound", inspect)
      installing?.removeEventListener("statechange", inspect)
    }
    const done = (error?: Error) => {
      if (finished) return
      finished = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const changed = () => {
      if (container.controller && container.controller !== initialController)
        done()
    }
    const aborted = () => done(new Error("更新を中断しました。"))
    const inspect = () => {
      if (finished || !registration) return
      progressed()
      changed()
      if (finished) return
      // An install that goes redundant with nothing to take its place failed,
      // usually because a newer deployment replaced the files mid-install.
      if (
        installing?.state === "redundant" &&
        !registration.waiting &&
        !registration.installing
      ) {
        done(
          new Error(
            "新しいバージョンを取得できませんでした。もう一度お試しください。"
          )
        )
        return
      }
      if (registration.waiting)
        registration.waiting.postMessage({ type: "SKIP_WAITING" })
      if (registration.installing !== installing) {
        installing?.removeEventListener("statechange", inspect)
        installing = registration.installing
        installing?.addEventListener("statechange", inspect)
      }
    }
    const timer = setTimeout(lost, totalLimit)
    idle = setTimeout(lost, idleLimit)
    container.addEventListener("controllerchange", changed)
    signal.addEventListener("abort", aborted, { once: true })
    if (signal.aborted) {
      aborted()
      return
    }
    void (async () => {
      registration = await container.getRegistration()
      if (finished) return
      changed()
      if (finished) return
      if (!registration)
        throw new Error(
          "更新を確認できませんでした。ページを再読み込みしてください。"
        )
      registration.addEventListener("updatefound", inspect)
      if (registration.waiting || registration.installing) {
        inspect()
        return
      }
      await registration.update()
      if (finished) return
      inspect()
      // The notice may be stale after another tab has already installed the update.
      if (!registration.waiting && !registration.installing) done()
    })().catch((error: unknown) =>
      done(error instanceof Error ? error : new Error("更新に失敗しました。"))
    )
  })
}

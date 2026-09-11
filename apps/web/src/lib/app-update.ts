type Worker = EventTarget & {
  state: string
  postMessage: (message: { type: string }) => void
}
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
    const cleanup = () => {
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
      changed()
      if (finished) return
      if (registration.waiting)
        registration.waiting.postMessage({ type: "SKIP_WAITING" })
      if (registration.installing !== installing) {
        installing?.removeEventListener("statechange", inspect)
        installing = registration.installing
        installing?.addEventListener("statechange", inspect)
      }
    }
    const timer = setTimeout(
      () =>
        done(new Error("更新を完了できませんでした。もう一度お試しください。")),
      15_000
    )
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
      if (registration.waiting) {
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

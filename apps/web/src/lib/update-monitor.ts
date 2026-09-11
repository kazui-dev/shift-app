type Worker = EventTarget & { state: string }
type Registration = EventTarget & {
  active: Worker | null
  waiting: Worker | null
  installing: Worker | null
  update: () => Promise<unknown>
}

/** Detection is independent of the worker finishing its asset installation. */
export function monitorUpdates(
  registration: Registration,
  available: (worker: Worker) => void,
  canCheck: () => boolean,
  now = Date.now
) {
  let disposed = false
  let pending: Promise<void> | null = null
  let lastCheck = -Infinity
  let observed: Worker | null = null
  let announced: Worker | null = null
  let initial: Worker | null = null
  const inspect = () => {
    if (disposed) return
    const worker = registration.installing ?? registration.waiting
    if (!registration.active && worker && !initial) initial = worker
    if (worker !== observed) {
      observed?.removeEventListener("statechange", inspect)
      observed = worker
      observed?.addEventListener("statechange", inspect)
    }
    if (
      worker &&
      worker !== initial &&
      worker.state !== "redundant" &&
      worker !== announced
    ) {
      announced = worker
      available(worker)
    }
  }
  registration.addEventListener("updatefound", inspect)
  inspect()
  const check = () => {
    if (disposed || !canCheck()) return Promise.resolve()
    if (pending) return pending
    if (now() - lastCheck < 60_000 || registration.installing)
      return Promise.resolve()
    lastCheck = now()
    pending = registration
      .update()
      .then(inspect)
      .catch(() => {
        // Background checks are retried on the next interval or return online.
        lastCheck = -Infinity
      })
      .finally(() => {
        pending = null
      })
    return pending
  }
  void check()
  return {
    check,
    dispose: () => {
      disposed = true
      registration.removeEventListener("updatefound", inspect)
      observed?.removeEventListener("statechange", inspect)
    },
  }
}

/** Serialize server writes while keeping the latest local intent visible. */
export function latestWriter<T>(
  read: () => T,
  apply: (value: T) => void,
  write: (value: T) => Promise<T>
) {
  let revision = 0
  let pending = 0
  let confirmed = read()
  let queue = Promise.resolve()
  return (value: T) => {
    if (!pending) confirmed = read()
    pending++
    const current = ++revision
    apply(value)
    const result = queue.then(async () => {
      try {
        confirmed = await write(value)
        if (current === revision) apply(confirmed)
      } catch (error) {
        if (current === revision) {
          apply(confirmed)
          throw error
        }
      } finally {
        pending--
      }
    })
    queue = result.catch(() => {})
    return result
  }
}

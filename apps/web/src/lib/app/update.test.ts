import { afterEach, expect, it, vi } from "vite-plus/test"
import { activateAppUpdate } from "@/lib/app/update"
class Worker extends EventTarget {
  state = "installed"
  postMessage = vi.fn<(message: { type: string }) => void>()
}
class Registration extends EventTarget {
  waiting: Worker | null = new Worker()
  installing: Worker | null = null
  update = vi.fn<() => Promise<undefined>>(async () => undefined)
}
class Container extends EventTarget {
  controller: object | null = {}
  registration = new Registration()
  getRegistration = vi.fn<() => Promise<Registration>>(
    async () => this.registration
  )
}
afterEach(() => vi.useRealTimers())
it("waits for the new controller after requesting activation", async () => {
  const container = new Container()
  const task = activateAppUpdate(
    container,
    container.controller,
    new AbortController().signal
  )
  await Promise.resolve()
  expect(container.registration.waiting?.postMessage).toHaveBeenCalledWith({
    type: "SKIP_WAITING",
  })
  let completed = false
  void task.then(() => {
    completed = true
  })
  await Promise.resolve()
  expect(completed).toBe(false)
  container.controller = {}
  container.dispatchEvent(new Event("controllerchange"))
  await task
})
it("handles a controller already changed by another tab", async () => {
  const container = new Container()
  await activateAppUpdate(container, {}, new AbortController().signal)
  expect(container.registration.update).not.toHaveBeenCalled()
})
it("rechecks a stale notification without waiting forever", async () => {
  const container = new Container()
  container.registration.waiting = null
  await activateAppUpdate(
    container,
    container.controller,
    new AbortController().signal
  )
  expect(container.registration.update).toHaveBeenCalledOnce()
})
it("bounds registration lookup as well as activation", async () => {
  vi.useFakeTimers()
  const container = new Container()
  container.getRegistration.mockImplementation(() => new Promise(() => {}))
  const task = activateAppUpdate(
    container,
    container.controller,
    new AbortController().signal
  )
  await Promise.all([
    expect(task).rejects.toThrow("更新を完了できませんでした"),
    vi.advanceTimersByTimeAsync(15_000),
  ])
})
it("stops observing when the caller leaves", async () => {
  const container = new Container(),
    abort = new AbortController()
  const task = activateAppUpdate(container, container.controller, abort.signal)
  abort.abort()
  await expect(task).rejects.toThrow("中断")
  expect(container.registration.waiting?.postMessage).not.toHaveBeenCalled()
})
it("activates an update that finishes installing after the click", async () => {
  const container = new Container(),
    registration = container.registration,
    worker = new Worker()
  registration.waiting = null
  registration.installing = worker
  const task = activateAppUpdate(
    container,
    container.controller,
    new AbortController().signal
  )
  await Promise.resolve()
  await Promise.resolve()
  registration.waiting = worker
  registration.installing = null
  worker.dispatchEvent(new Event("statechange"))
  expect(worker.postMessage).toHaveBeenCalledOnce()
  container.controller = {}
  container.dispatchEvent(new Event("controllerchange"))
  await task
})

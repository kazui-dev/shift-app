import { expect, it, vi } from "vite-plus/test"
import { monitorUpdates } from "@/app/lib/update-monitor"
class Worker extends EventTarget {
  state = "installing"
}
class Registration extends EventTarget {
  active: Worker | null = new Worker()
  waiting: Worker | null = null
  installing: Worker | null = null
  update = vi.fn<() => Promise<void>>(async () => {})
}
it("announces detection before installation completes, including a worker already installing at startup", () => {
  const registration = new Registration()
  const detected = vi.fn<(worker: Worker) => void>()
  const worker = new Worker()
  registration.installing = worker
  const monitor = monitorUpdates(registration, detected, () => true)
  expect(detected).toHaveBeenCalledWith(worker)
  expect(registration.update).not.toHaveBeenCalled()
  worker.state = "installed"
  registration.waiting = worker
  registration.installing = null
  worker.dispatchEvent(new Event("statechange"))
  expect(detected).toHaveBeenCalledTimes(1)
  const next = new Worker()
  registration.installing = next
  registration.dispatchEvent(new Event("updatefound"))
  expect(detected).toHaveBeenCalledTimes(2)
  monitor.dispose()
  registration.installing = new Worker()
  registration.dispatchEvent(new Event("updatefound"))
  expect(detected).toHaveBeenCalledTimes(2)
})
it("does not offer an update for the first installation", () => {
  const registration = new Registration()
  registration.active = null
  const worker = new Worker()
  registration.installing = worker
  const detected = vi.fn<(worker: Worker) => void>()
  const monitor = monitorUpdates(registration, detected, () => true)
  registration.active = worker
  registration.installing = null
  worker.state = "activated"
  worker.dispatchEvent(new Event("statechange"))
  expect(detected).not.toHaveBeenCalled()
  registration.installing = new Worker()
  registration.dispatchEvent(new Event("updatefound"))
  expect(detected).toHaveBeenCalledTimes(1)
  monitor.dispose()
})
it("checks at startup, shares in-flight checks and throttles clustered resume events", async () => {
  const registration = new Registration()
  let time = 0,
    online = true
  let finish: (() => void) | undefined
  registration.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const monitor = monitorUpdates(
    registration,
    () => {},
    () => online,
    () => time
  )
  const first = monitor.check()
  expect(monitor.check()).toBe(first)
  expect(registration.update).toHaveBeenCalledTimes(1)
  finish?.()
  await first
  await monitor.check()
  expect(registration.update).toHaveBeenCalledTimes(1)
  time = 60_000
  online = false
  await monitor.check()
  expect(registration.update).toHaveBeenCalledTimes(1)
  online = true
  const second = monitor.check()
  expect(registration.update).toHaveBeenCalledTimes(2)
  finish?.()
  await second
  monitor.dispose()
  time = 120_000
  await monitor.check()
  expect(registration.update).toHaveBeenCalledTimes(2)
})
it("allows retry after a failed background check", async () => {
  const registration = new Registration()
  registration.update.mockRejectedValueOnce(new Error("offline"))
  const monitor = monitorUpdates(
    registration,
    () => {},
    () => true
  )
  await monitor.check()
  await monitor.check()
  expect(registration.update).toHaveBeenCalledTimes(2)
  monitor.dispose()
})

import { expect, it } from "vite-plus/test"
import { latestWriter } from "./latest-writer"

it("serializes rapid intents, ignores an obsolete failure and rolls back only the latest failure", async () => {
  let visible = 0
  const writes: number[] = []
  const releases: Array<(value: number) => void> = []
  const failures: Array<(reason: Error) => void> = []
  const write = latestWriter(
    () => visible,
    (value) => {
      visible = value
    },
    (value) => {
      writes.push(value)
      return new Promise<number>((resolve, reject) => {
        releases.push(resolve)
        failures.push(reject)
      })
    }
  )
  const first = write(1)
  const second = write(2)
  expect(visible).toBe(2)
  await Promise.resolve()
  expect(writes).toEqual([1])
  failures[0]?.(new Error("old failure"))
  await first
  await Promise.resolve()
  expect(visible).toBe(2)
  expect(writes).toEqual([1, 2])
  releases[1]?.(2)
  await second
  const third = write(3)
  await Promise.resolve()
  failures[2]?.(new Error("latest failure"))
  await expect(third).rejects.toThrow("latest failure")
  expect(visible).toBe(2)
  visible = 7
  const fourth = write(4)
  await Promise.resolve()
  failures[3]?.(new Error("failure after external update"))
  await expect(fourth).rejects.toThrow()
  expect(visible).toBe(7)
})
it("keeps a newer intent visible when an older save succeeds", async () => {
  let visible = false
  let release: ((value: boolean) => void) | undefined
  const write = latestWriter(
    () => visible,
    (value) => {
      visible = value
    },
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve
      })
  )
  const first = write(true)
  const second = write(false)
  await Promise.resolve()
  release?.(true)
  await first
  expect(visible).toBe(false)
  await Promise.resolve()
  release?.(false)
  await second
  expect(visible).toBe(false)
})

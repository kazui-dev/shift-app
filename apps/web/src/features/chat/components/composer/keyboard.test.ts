import { expect, it } from "vite-plus/test"
import { keyboardAfterResize } from "@/features/chat/components/composer/keyboard"

it("opens when the viewport shrinks well below its full height and closes when it returns", () => {
  const full = keyboardAfterResize(null, { width: 360, height: 731 })
  expect(full).toEqual({ width: 360, full: 731, open: false })
  const open = keyboardAfterResize(full, { width: 360, height: 404 })
  expect(open).toEqual({ width: 360, full: 731, open: true })
  expect(keyboardAfterResize(open, { width: 360, height: 731 })).toEqual({
    width: 360,
    full: 731,
    open: false,
  })
})

it("ignores small changes such as browser bars", () => {
  const full = keyboardAfterResize(null, { width: 360, height: 731 })
  expect(keyboardAfterResize(full, { width: 360, height: 650 }).open).toBe(
    false
  )
})

it("learns the full height when it first measures with the keyboard open", () => {
  const shrunk = keyboardAfterResize(null, { width: 360, height: 404 })
  expect(shrunk.open).toBe(false)
  expect(keyboardAfterResize(shrunk, { width: 360, height: 731 })).toEqual({
    width: 360,
    full: 731,
    open: false,
  })
})

it("starts over when rotating changes the width", () => {
  const portrait = keyboardAfterResize(null, { width: 360, height: 731 })
  expect(keyboardAfterResize(portrait, { width: 731, height: 360 })).toEqual({
    width: 731,
    full: 360,
    open: false,
  })
})

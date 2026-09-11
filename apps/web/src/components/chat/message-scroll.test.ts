import { expect, it } from "vite-plus/test"
import {
  MessageScroll,
  type ScrollPosition,
  type ScrollStatus,
} from "./message-scroll"

function fixture(saved?: ScrollPosition) {
  const view = { top: 0, height: 600, extent: 2000, row: 1000, present: true }
  let status: ScrollStatus = { atBottom: true, showLatest: false }
  const moves: { top: number; smooth: boolean }[] = []
  const scroll = new MessageScroll(
    {
      top: () => view.top,
      height: () => view.height,
      extent: () => view.extent,
      move: (top, smooth) => {
        moves.push({ top, smooth })
        if (!smooth)
          view.top = Math.max(0, Math.min(top, view.extent - view.height))
      },
      anchor: () =>
        view.present ? { id: "reading", offset: view.row - view.top } : null,
      locate: () => (view.present ? view.row - view.top : null),
    },
    (next) => {
      status = next
    },
    saved
  )
  return { view, scroll, moves, status: () => status }
}

it("settles outgoing rows and changing composer/image heights before paint", () => {
  const { view, scroll, status } = fixture()
  scroll.layout()
  expect(view.top).toBe(1400)
  view.extent += 70
  scroll.layout()
  expect(view.top).toBe(1470)
  view.height = 350
  view.extent += 100
  scroll.layout()
  expect(view.top).toBe(1820)
  expect(status()).toEqual({ atBottom: true, showLatest: false })
})

it("preserves the reading anchor through prepend and image changes, then follows a send", () => {
  const { view, scroll } = fixture()
  scroll.layout(900)
  view.row += 400
  view.extent += 400
  scroll.layout()
  expect(view.top).toBe(1300)
  view.row += 90
  view.extent += 90
  scroll.layout()
  expect(view.top).toBe(1390)
  scroll.follow()
  view.extent += 70
  scroll.layout()
  expect(view.top).toBe(view.extent - view.height)
})

it("separates following from the jump affordance and avoids threshold flicker", () => {
  const { view, scroll, status } = fixture()
  scroll.layout()
  scroll.read()
  view.top -= 60
  scroll.scroll()
  expect(status()).toEqual({ atBottom: false, showLatest: false })
  view.top = 1090
  scroll.scroll()
  expect(status().showLatest).toBe(true)
  view.top = 1110
  scroll.scroll()
  expect(status().showLatest).toBe(true)
  view.top = 1260
  scroll.scroll()
  expect(status().showLatest).toBe(false)
  view.top = 1390
  scroll.scroll()
  view.extent += 50
  scroll.layout()
  expect(view.top).toBe(1390)
  view.top = 1450
  scroll.scroll()
  view.extent += 50
  scroll.layout()
  expect(view.top).toBe(1500)
})

it("smoothly jumps without marking distant messages read, and allows interruption", () => {
  const { view, scroll, status, moves } = fixture()
  scroll.layout(500)
  scroll.latest(true)
  expect(moves.at(-1)).toEqual({ top: 2000, smooth: true })
  expect(status()).toEqual({ atBottom: false, showLatest: false })
  view.top = 800
  scroll.scroll()
  scroll.interrupt()
  expect(moves.at(-1)).toEqual({ top: 800, smooth: false })
  view.extent += 50
  scroll.layout()
  expect(view.top).toBe(800)
  expect(status().showLatest).toBe(true)
  scroll.latest(true)
  view.top = 1450
  scroll.scroll()
  expect(status()).toEqual({ atBottom: true, showLatest: false })
  view.extent += 50
  scroll.layout()
  expect(view.top).toBe(1500)
})

it("restores reading by message identity and keeps following rooms at their new bottom", () => {
  const first = fixture()
  first.scroll.layout(800)
  const second = fixture(first.scroll.position())
  second.view.row += 200
  second.view.extent += 200
  second.scroll.layout()
  expect(second.view.top).toBe(1000)
  second.scroll.latest(false)
  const third = fixture(second.scroll.position())
  third.view.extent = 3000
  third.scroll.layout()
  expect(third.view.top).toBe(2400)
})

it("handles short histories, removed anchors and reduced-motion jumps", () => {
  const { view, scroll, moves, status } = fixture()
  scroll.layout(500)
  view.present = false
  scroll.layout()
  expect(view.top).toBe(500)
  scroll.interrupt()
  scroll.latest(false)
  expect(moves.at(-1)?.smooth).toBe(false)
  expect(status().atBottom).toBe(true)
  view.extent = 200
  scroll.layout()
  expect(view.top).toBe(0)
  expect(status().showLatest).toBe(false)
})

it("does not mistake image layout scroll events for the reader moving away", () => {
  const { view, scroll } = fixture()
  expect(scroll.isAtBottom()).toBe(false)
  scroll.layout()
  view.extent += 183
  scroll.scroll()
  scroll.layout()
  expect(view.top).toBe(view.extent - view.height)
  scroll.read()
  view.top -= 200
  scroll.scroll()
  const reading = view.top
  view.extent += 80
  scroll.layout()
  expect(view.top).toBe(reading)
})

it("does not write scroll position during reading or affordance-only rerenders", () => {
  const { view, scroll, moves } = fixture()
  scroll.layout()
  const count = moves.length
  scroll.read()
  view.top -= 20
  scroll.scroll()
  scroll.layout()
  expect(view.top).toBe(1380)
  expect(moves).toHaveLength(count)
  view.top -= 400
  scroll.scroll()
  scroll.layout()
  expect(moves).toHaveLength(count)
  view.top -= 10
  scroll.scroll()
  scroll.layout()
  expect(moves).toHaveLength(count)
})

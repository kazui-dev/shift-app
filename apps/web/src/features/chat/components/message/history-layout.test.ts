import { expect, it } from "vite-plus/test"
import { Virtualizer } from "@tanstack/react-virtual"
import {
  historyWindow,
  messageOffset,
  nearestMessage,
} from "@/features/chat/components/message/history-layout"
import {
  MessageScroll,
  type ScrollPosition,
} from "@/features/chat/components/message/scroll"

const messages = (start: number, count: number) =>
  Array.from({ length: count }, (_, offset) => ({
    id: `message-${start + offset}`,
    sequence: start + offset,
  }))

function fixture(saved?: ScrollPosition) {
  let rows = messages(100, 2000)
  let top = 0
  let measured = false
  const moves: { top: number; smooth: boolean }[] = []
  const coordinates = new Virtualizer<HTMLElement, HTMLLIElement>({
    count: rows.length,
    getScrollElement: () => null,
    getItemKey: (index) => rows[index]?.id ?? "missing",
    estimateSize: () => 80,
    initialRect: { width: 390, height: 600 },
    scrollMargin: 16,
    scrollToFn: () => {
      throw new Error("Virtualizer must never write scroll position")
    },
    observeElementOffset: () => undefined,
    observeElementRect: () => undefined,
  })
  coordinates.shouldAdjustScrollPositionOnItemSizeChange = () => false
  const locate = (id: string) => {
    const index = rows.findIndex((row) => row.id === id)
    return messageOffset(coordinates, index, 0)
  }
  const anchor = () => {
    const item = coordinates.getVirtualItemForOffset(top)
    const row = item && rows[item.index]
    return item && row
      ? {
          id: row.id,
          offset: item.start - top,
          index: item.index,
          sequence: row.sequence,
        }
      : null
  }
  const scroll = new MessageScroll(
    {
      top: () => top,
      height: () => 600,
      extent: () => coordinates.getTotalSize() + 64,
      move: (next, smooth) => {
        moves.push({ top: next, smooth })
        if (!smooth)
          top = Math.max(
            0,
            Math.min(next, coordinates.getTotalSize() + 64 - 600)
          )
      },
      anchor,
      locate: (id) => {
        const start = locate(id)
        return start === null ? null : start - top
      },
      measured: () => measured,
      nearest: (index, sequence) => nearestMessage(rows, index, sequence),
    },
    () => undefined,
    saved
  )
  return {
    scroll,
    coordinates,
    locate,
    anchor,
    moves,
    top: () => top,
    arrive: () => {
      top = moves.at(-1)?.top ?? top
      measured = true
      scroll.scroll()
    },
    rows: (next: typeof rows) => {
      rows = next
      coordinates.setOptions({
        ...coordinates.options,
        count: rows.length,
        getItemKey: (index) => rows[index]?.id ?? "missing",
      })
      coordinates.getTotalSize()
    },
  }
}

it("keeps a measured ID and its offset through prepend, edits, image growth and deletion above it", () => {
  const view = fixture()
  view.scroll.layout(40037)
  const anchor = view.anchor()
  view.rows(messages(50, 2050))
  view.scroll.layout()
  expect(view.anchor()).toMatchObject({
    id: anchor?.id,
    offset: anchor?.offset,
  })
  // The estimate of a newly prepended row was wrong. Only one coordinate owner corrects it.
  view.coordinates.resizeItem(10, 347)
  view.scroll.layout()
  expect(view.anchor()).toMatchObject({
    id: anchor?.id,
    offset: anchor?.offset,
  })
  view.coordinates.resizeItem(510, 28)
  view.scroll.layout()
  expect(view.anchor()).toMatchObject({
    id: anchor?.id,
    offset: anchor?.offset,
  })
  view.rows(messages(50, 2050).filter((row) => row.sequence !== 70))
  view.scroll.layout()
  expect(view.anchor()).toMatchObject({
    id: anchor?.id,
    offset: anchor?.offset,
  })
})

it("restores by identity after prepends and chooses the next survivor if the saved ID was deleted", () => {
  const first = fixture()
  first.scroll.layout(40037)
  const saved = first.scroll.position()
  const second = fixture(saved)
  second.rows(messages(0, 2100).filter((row) => row.id !== saved.anchor?.id))
  second.scroll.layout()
  expect(second.anchor()?.sequence).toBe((saved.anchor?.sequence ?? 0) + 1)
  expect(second.anchor()?.offset).toBe(saved.anchor?.offset)
  expect(nearestMessage([], 0, 2)).toBeNull()
  expect(nearestMessage(messages(1, 3), 8)).toBe("message-3")
  expect(nearestMessage(messages(1, 3), 8, 7)).toBe("message-3")
})

it("targets an unmounted distant ID, retargets measured coordinates smoothly, then settles", () => {
  const view = fixture()
  view.scroll.layout()
  const start = view.top()
  expect(view.scroll.target("message-200", true)).toBe(true)
  expect(view.top()).toBe(start)
  expect(view.scroll.arrived("message-200")).toBe(false)
  view.coordinates.resizeItem(50, 307)
  view.scroll.layout()
  expect(view.moves.slice(1).every((move) => move.smooth)).toBe(true)
  expect(view.moves.at(-1)?.top).toBe((view.locate("message-200") ?? 0) - 200)
  view.arrive()
  expect(view.scroll.arrived("message-200")).toBe(true)
  // A later resize in the destination's overscan must still adjust before finishing.
  view.coordinates.resizeItem(99, 147)
  view.scroll.layout()
  expect(view.scroll.arrived("message-200")).toBe(false)
  view.arrive()
  view.scroll.finishTarget("message-200")
  const savedTop = view.top()
  view.rows(messages(100, 2100))
  view.scroll.layout()
  expect(view.top()).toBe(savedTop)
})

it("interrupts a distant journey and settles a reduced-motion target after measurement", () => {
  const view = fixture()
  view.scroll.layout()
  view.scroll.target("message-200", true)
  view.scroll.interrupt()
  const stopped = view.top()
  view.coordinates.resizeItem(50, 99)
  view.scroll.layout()
  expect(view.moves.at(-1)?.smooth).toBe(false)
  expect(view.top()).toBe(stopped + 19)
  expect(view.scroll.target("unknown", false)).toBe(false)
  view.scroll.target("message-200", false)
  expect(view.scroll.arrived("message-200")).toBe(false)
  view.arrive()
  view.scroll.finishTarget("message-200")
  expect(view.scroll.arrived("message-200")).toBe(true)
})

it("bounds short-row rendering by pixels with ordered focus retention even after many more pages", () => {
  const view = fixture()
  view.coordinates.getTotalSize()
  for (let index = 0; index < 2000; index++)
    view.coordinates.resizeItem(index, 24)
  const window = historyWindow(view.coordinates, 24000, 600, 1)
  expect(window.length).toBeLessThanOrEqual(128)
  expect(window[0]).toBe(1)
  expect(window).toEqual(window.toSorted((a, b) => a - b))
  expect(historyWindow(view.coordinates, 24000, 600, 1000).length).toBe(
    window.length - 1
  )
  view.rows(messages(100, 20000))
  expect(historyWindow(view.coordinates, 24000, 600, 1)).toEqual(window)
  view.rows([])
  expect(historyWindow(view.coordinates, 0, 600)).toEqual([])
})

it("uses fresh measurements for an offscreen unread start before the next render", () => {
  const view = fixture()
  view.coordinates.getTotalSize()
  view.coordinates.resizeItem(490, 32)
  view.coordinates.resizeItem(495, 16)
  const unread = view.locate("message-600")
  expect(unread).toBe(40016 - 112)
  view.scroll.layout(unread ?? undefined)
  expect(view.anchor()).toMatchObject({ id: "message-600", offset: 0 })
  expect(messageOffset(view.coordinates, undefined, 0)).toBeNull()
  expect(nearestMessage([{ id: "pending", sequence: null }], 0, 1)).toBe(
    "pending"
  )
})

it("handles deletion of the entire history during restoration or a reply journey", () => {
  const first = fixture()
  first.scroll.layout(40037)
  const restored = fixture(first.scroll.position())
  restored.rows([])
  restored.scroll.layout()
  expect(restored.anchor()).toBeNull()
  expect(nearestMessage([], 0)).toBeNull()

  first.scroll.target("message-200", true)
  expect(first.scroll.isTargeting("message-200")).toBe(true)
  first.scroll.finishTarget("old-request")
  expect(first.scroll.isTargeting("message-200")).toBe(true)
  first.rows([])
  first.scroll.layout()
  first.scroll.scroll()
  expect(first.scroll.isTargeting("message-200")).toBe(false)
  expect(first.scroll.arrived("message-200")).toBe(false)
})

it("keeps a keyboard page destination through measurements and releases it on arrival", () => {
  const view = fixture()
  view.scroll.layout(40037)
  view.scroll.target("message-590", true, -12)
  expect(view.scroll.isTargeting("message-590")).toBe(true)
  expect(view.scroll.target("missing", true)).toBe(false)
  view.coordinates.resizeItem(450, 32)
  view.scroll.layout()
  expect(view.moves.at(-1)?.top).toBe((view.locate("message-590") ?? 0) + 12)
  view.arrive()
  expect(view.scroll.isTargeting("message-590")).toBe(false)
  const anchor = view.anchor()
  view.rows(messages(0, 2100))
  view.scroll.layout()
  expect(view.anchor()).toMatchObject({
    id: anchor?.id,
    offset: anchor?.offset,
  })
})

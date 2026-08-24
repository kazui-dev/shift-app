import { describe, expect, it } from "vite-plus/test"

import {
  beginPagerGesture,
  beginPagerSettlement,
  finishPagerSettlement,
  swipeDirection,
} from "./swipe-pager"

describe("swipeDirection", () => {
  it("移動量が小さく遅い操作は確定しない", () => {
    expect(swipeDirection({ distance: -20, elapsed: 300, width: 390 })).toBe(0)
  })

  it("十分に移動した操作は一日分だけ確定する", () => {
    expect(swipeDirection({ distance: -100, elapsed: 400, width: 390 })).toBe(1)
    expect(swipeDirection({ distance: 100, elapsed: 400, width: 390 })).toBe(-1)
  })

  it("短くても速いフリックは方向を確定する", () => {
    expect(swipeDirection({ distance: -18, elapsed: 20, width: 390 })).toBe(1)
    expect(swipeDirection({ distance: 18, elapsed: 20, width: 390 })).toBe(-1)
  })

  it("一回の操作で複数ページを返さない", () => {
    expect(swipeDirection({ distance: -900, elapsed: 40, width: 390 })).toBe(1)
    expect(swipeDirection({ distance: 900, elapsed: 40, width: 390 })).toBe(-1)
  })

  it("幅を取得できない場合は確定しない", () => {
    expect(swipeDirection({ distance: -100, elapsed: 20, width: 0 })).toBe(0)
  })
})

describe("pager transaction", () => {
  it("確定中の操作を完了しながら次のジェスチャーを開始する", () => {
    const settling = beginPagerSettlement(3, 1)
    const next = beginPagerGesture(settling, 4)

    expect(next.interruptedDirection).toBe(1)
    expect(next.phase).toEqual({ kind: "dragging", gestureId: 4 })
  })

  it("古い完了通知で新しい操作を確定しない", () => {
    const nextGesture = beginPagerGesture(beginPagerSettlement(3, 1), 4).phase
    const staleFinish = finishPagerSettlement(nextGesture, 3)

    expect(staleFinish.direction).toBeNull()
    expect(staleFinish.phase).toEqual({ kind: "dragging", gestureId: 4 })
  })

  it("現在の完了通知だけが移動を確定する", () => {
    const finish = finishPagerSettlement(beginPagerSettlement(5, -1), 5)

    expect(finish.direction).toBe(-1)
    expect(finish.phase).toEqual({ kind: "idle" })
  })

  it("待機中の新しい操作には未確定の移動がない", () => {
    const next = beginPagerGesture({ kind: "idle" }, 1)

    expect(next.interruptedDirection).toBeNull()
    expect(next.phase).toEqual({ kind: "dragging", gestureId: 1 })
  })

  it("確定アニメーションを待たずに連続操作できる", () => {
    const secondGesture = beginPagerGesture(beginPagerSettlement(1, 1), 2)
    const thirdGesture = beginPagerGesture(beginPagerSettlement(2, 1), 3)

    expect([
      secondGesture.interruptedDirection,
      thirdGesture.interruptedDirection,
    ]).toEqual([1, 1])
    expect(thirdGesture.phase).toEqual({ kind: "dragging", gestureId: 3 })
  })
})

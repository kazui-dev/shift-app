import { describe, expect, it } from "vite-plus/test"

import { validateAvailabilityWindows } from "@/lib/availability-windows"

const windowAt = (
  id: string,
  date: string,
  startsAt: string,
  endsAt: string
) => ({
  id,
  date,
  startsAt,
  endsAt,
})

describe("availability window validation", () => {
  it("accepts ordered ranges across multiple dates", () => {
    expect(
      validateAvailabilityWindows([
        windowAt("1", "2026-11-01", "2026-11-01T09:00", "2026-11-01T12:00"),
        windowAt("2", "2026-11-02", "2026-11-02T14:00", "2026-11-02T17:00"),
      ])
    ).toBeNull()
  })

  it("rejects an end that is not after its start", () => {
    expect(
      validateAvailabilityWindows([
        windowAt("1", "2026-11-01", "2026-11-01T12:00", "2026-11-01T09:00"),
      ])
    ).toBe("終了時刻は開始時刻より後にしてください。")
  })

  it("rejects overlap within a date", () => {
    expect(
      validateAvailabilityWindows([
        windowAt("1", "2026-11-02", "2026-11-02T01:00", "2026-11-02T03:00"),
        windowAt("2", "2026-11-02", "2026-11-02T02:00", "2026-11-02T04:00"),
      ])
    ).toBe("時間帯が重複しています。")
  })

  it("rejects a range that crosses a configured date", () => {
    expect(
      validateAvailabilityWindows([
        windowAt("1", "2026-11-01", "2026-11-01T22:00", "2026-11-02T01:00"),
      ])
    ).toBe("時間帯は同じ日付の中で入力してください。")
  })

  it("rejects more than the schema maximum", () => {
    const windows = Array.from({ length: 65 }, (_, index) =>
      windowAt(
        String(index),
        `2026-11-${String(index + 1).padStart(2, "0")}`,
        `2026-11-${String(index + 1).padStart(2, "0")}T09:00`,
        `2026-11-${String(index + 1).padStart(2, "0")}T10:00`
      )
    )
    expect(validateAvailabilityWindows(windows)).toBe(
      "時間帯は64件まで追加できます。"
    )
  })
})

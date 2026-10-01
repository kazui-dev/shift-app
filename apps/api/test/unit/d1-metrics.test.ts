import { expect, it, vi } from "vite-plus/test"
import { recordD1 } from "../../src/lib/d1-metrics"

it("logs only counters and a fixed operation, preserving the result", () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {})
  try {
    const result = {
      meta: { rows_read: 123, rows_written: 2 },
      results: [{ secret: "private data" }],
    }
    expect(recordD1("test.operation", result)).toBe(result)
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        message: "D1 query usage",
        operation: "test.operation",
        rowsRead: 123,
        rowsWritten: 2,
      })
    )
    expect(recordD1("test.operation", { meta: {} })).toEqual({ meta: {} })
    expect(recordD1("test.operation", {})).toEqual({})
    expect(log).toHaveBeenCalledTimes(1)
  } finally {
    log.mockRestore()
  }
})

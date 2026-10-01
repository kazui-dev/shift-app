/** Record D1's execution counters, never SQL, parameters or returned data.
 * Query Insights is sampled; these counters let us check the costly operations
 * without attributing its estimation error to a particular query. */
export function recordD1<
  T extends {
    meta?: { rows_read?: number; rows_written?: number }
  },
>(operation: string, result: T): T {
  const { rows_read: rowsRead, rows_written: rowsWritten } = result.meta ?? {}
  if (typeof rowsRead === "number" && typeof rowsWritten === "number") {
    console.info(
      JSON.stringify({
        message: "D1 query usage",
        operation,
        rowsRead,
        rowsWritten,
      })
    )
  }
  return result
}

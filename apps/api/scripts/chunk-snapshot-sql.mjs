import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** Wrangler batches a whole local SQL file; keep each batch bounded. */
export function splitStatements(sql) {
  const statements = []
  let start = 0
  let quote = null
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    if (quote !== null) {
      if (char === quote) {
        if (sql[index + 1] === quote) index += 1
        else quote = null
      }
    } else if (char === "'" || char === '"') {
      quote = char
    } else if (char === ";") {
      const statement = sql.slice(start, index + 1).trim()
      if (statement) statements.push(statement)
      start = index + 1
    }
  }
  if (quote !== null || sql.slice(start).trim()) {
    throw new Error("Incomplete SQL export")
  }
  return statements
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, outputDir, ...tables] = process.argv.slice(2)
  if (!input || !outputDir)
    throw new Error("Expected SQL file and output directory")
  const statements = splitStatements(readFileSync(input, "utf8"))
  if (statements.length === 0) throw new Error("Empty SQL export")
  const order = new Map(tables.map((table, index) => [table, index]))
  const orderedStatements = statements
    .map((statement) => {
      if (statement.startsWith("PRAGMA ")) return { statement, rank: -1 }
      const table = /^INSERT(?: OR REPLACE)? INTO "([a-z_]+)" /.exec(
        statement
      )?.[1]
      const rank = table && order.get(table)
      if (rank === undefined)
        throw new Error("Unexpected SQL in production export")
      return { statement, rank }
    })
    .sort((left, right) => left.rank - right.rank)
  const batches = []
  let batch = []
  let bytes = 0
  for (const { statement, rank } of orderedStatements) {
    const size = Buffer.byteLength(statement, "utf8") + 1
    if (size > 100_000) {
      throw new Error(`An exported ${tables[rank]} row is ${size} bytes`)
    }
    if (batch.length >= 200 || bytes + size > 100_000) {
      batches.push(batch)
      batch = []
      bytes = 0
    }
    batch.push(statement)
    bytes += size
  }
  if (batch.length > 0) batches.push(batch)
  for (const [index, batchStatements] of batches.entries()) {
    const filename = path.join(
      outputDir,
      `${String(index).padStart(5, "0")}.sql`
    )
    writeFileSync(filename, `${batchStatements.join("\n")}\n`, { mode: 0o600 })
  }
}

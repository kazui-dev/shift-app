import { readFileSync, readdirSync } from "node:fs"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { URL } from "node:url"

const folder = new URL("../../migrations/", import.meta.url)

/** The migration file names in order, optionally up to an exclusive number. */
export function migrations(before = Infinity): string[] {
  return readdirSync(folder)
    .filter(
      (file) => file.endsWith(".sql") && Number(file.slice(0, 4)) < before
    )
    .sort()
}

export function applyMigration(db: DatabaseSync, name: string) {
  db.exec(readFileSync(new URL(name, folder), "utf8"))
}

/** An in-memory database migrated to the schema, with foreign keys enforced. */
export function migrated(before?: number): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec("PRAGMA foreign_keys=ON")
  for (const name of migrations(before)) applyMigration(db, name)
  return db
}

/** A D1 binding over the database, matching the shapes the Worker relies on. */
export function d1Binding(
  db: DatabaseSync,
  hooks: { beforeBatch?: () => void } = {}
) {
  const prepare = (sql: string) => {
    const statement = (params: SQLInputValue[]) => ({
      bind: (...values: SQLInputValue[]) => statement(values),
      first: () => Promise.resolve(db.prepare(sql).get(...params) ?? null),
      all: () => {
        const results = db.prepare(sql).all(...params)
        return Promise.resolve({
          success: true,
          results,
          meta: {
            changes: Number(db.prepare("SELECT changes() AS n").get()?.n),
          },
        })
      },
      // Drizzle reads rows positionally; D1 answers `raw` with value arrays.
      raw: () =>
        Promise.resolve(
          db
            .prepare(sql)
            .all(...params)
            .map((row) => Object.values(row))
        ),
      run: () => {
        const result = db.prepare(sql).run(...params)
        return Promise.resolve({
          success: true,
          results: [],
          meta: { changes: Number(result.changes) },
        })
      },
    })
    return statement([])
  }
  return {
    prepare,
    batch: async (statements: { all: () => Promise<unknown> }[]) => {
      hooks.beforeBatch?.()
      db.exec("BEGIN")
      try {
        const result = await Promise.all(
          statements.map((statement) => statement.all())
        )
        db.exec("COMMIT")
        return result
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
    },
  }
}

import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vite-plus/test"
import { applyMigration } from "../support/sqlite"

function database(years: [number, string][] = []) {
  const db = new DatabaseSync(":memory:")
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE operating_years (year INTEGER PRIMARY KEY, status TEXT NOT NULL);`)
  for (const [year, status] of years) {
    db.prepare("INSERT INTO operating_years VALUES (?, ?)").run(year, status)
  }
  applyMigration(db, "0012_default_year.sql")
  return db
}

function selected(db: DatabaseSync) {
  return db.prepare("SELECT default_year FROM year_settings").get()
    ?.default_year
}

describe("default year database guarantees", () => {
  it("initializes on the first year and retains the choice when adding years", () => {
    const db = database()
    try {
      expect(selected(db)).toBeUndefined()
      db.exec("INSERT INTO operating_years VALUES (2026)")
      db.exec("INSERT INTO operating_years VALUES (2027)")
      expect(selected(db)).toBe(2026)
      db.exec("UPDATE year_settings SET default_year = 2027 WHERE id = 1")
      expect(selected(db)).toBe(2027)
    } finally {
      db.close()
    }
  })

  it.each([
    {
      years: [
        [2025, "active"],
        [2026, "active"],
        [2027, "draft"],
      ] satisfies [number, string][],
      expected: 2026,
    },
    {
      years: [
        [2025, "archived"],
        [2027, "draft"],
      ] satisfies [number, string][],
      expected: 2027,
    },
  ])("migrates existing years deterministically", ({ years, expected }) => {
    const db = database(years)
    try {
      expect(selected(db)).toBe(expected)
    } finally {
      db.close()
    }
  })

  it("rejects missing, duplicate, null, or nonexistent defaults", () => {
    const db = database([[2026, "active"]])
    try {
      for (const sql of [
        "DELETE FROM year_settings",
        "DELETE FROM operating_years WHERE year = 2026",
        "INSERT INTO year_settings VALUES (2, 2026)",
        "UPDATE year_settings SET id = 2",
        "UPDATE year_settings SET default_year = NULL",
        "UPDATE year_settings SET default_year = 2027",
      ]) {
        expect(() => db.exec(sql)).toThrow()
        expect(selected(db)).toBe(2026)
      }
    } finally {
      db.close()
    }
  })
})

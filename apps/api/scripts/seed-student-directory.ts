import { readFileSync, writeFileSync } from "node:fs"
import * as v from "valibot"

import {
  displayNameSchema,
  studentIdSchema,
} from "../../../packages/shared/src/auth.ts"

const [year, inputPath, outputPath] = process.argv.slice(2)
if (!year || !inputPath || !outputPath) {
  throw new Error(
    "Specify the year, the directory CSV, and the SQL path to write"
  )
}

const yearSchema = v.pipe(
  v.string(),
  v.transform(Number),
  v.integer(),
  v.minValue(2000),
  v.maxValue(2100)
)
/** The bureau and duty are optional; an empty column lists neither. */
const placementSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(80),
  v.transform((value) => (value.length > 0 ? value : null))
)
const rowSchema = v.object({
  studentId: studentIdSchema,
  displayName: displayNameSchema,
  bureau: placementSchema,
  duty: placementSchema,
})

/** The listed year, from the CSV of `学籍番号,氏名[,局[,担当]]`. */
const operatingYear = v.parse(yearSchema, year)
const lines = readFileSync(inputPath, "utf8")
  .replace(/^﻿/, "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0)

const entries = lines
  // A header row names the first column; the rest are people.
  .filter((line, index) => !(index === 0 && line.startsWith("学籍番号")))
  .map((line, index) => {
    const fields = line.split(",").map((field) => field.trim())
    if (fields.length < 2 || fields.length > 4) {
      throw new Error(
        `Row ${index + 1} must have the student ID, the name, and optionally the bureau and duty: ${line}`
      )
    }
    const [studentId, displayName, bureau = "", duty = ""] = fields
    return v.parse(rowSchema, { studentId, displayName, bureau, duty })
  })

const seen = new Set<string>()
for (const entry of entries) {
  if (seen.has(entry.studentId)) {
    throw new Error(`Duplicate student ID in the CSV: ${entry.studentId}`)
  }
  seen.add(entry.studentId)
}

const quote = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`
const statements = entries.map(
  (entry) =>
    `INSERT INTO student_directory (id, year, student_id, display_name, bureau, duty, created_at)
 VALUES (lower(hex(randomblob(16))), ${operatingYear}, ${quote(entry.studentId)}, ${quote(entry.displayName)}, ${quote(entry.bureau)}, ${quote(entry.duty)}, unixepoch() * 1000)
 ON CONFLICT (year, lower(student_id)) DO UPDATE SET
   display_name = excluded.display_name, bureau = excluded.bureau, duty = excluded.duty;`
)

writeFileSync(
  outputPath,
  `-- ${entries.length} entries for ${operatingYear}, generated from ${inputPath}\n${statements.join("\n")}\n`
)
console.info(`Wrote ${entries.length} directory entries to ${outputPath}`)

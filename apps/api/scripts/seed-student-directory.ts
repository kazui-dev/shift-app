import { readFileSync, writeFileSync } from "node:fs"
import * as v from "valibot"

import {
  displayNameSchema,
  studentIdSchema,
} from "../../../packages/shared/src/contracts/auth.ts"

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
/** The bureau, duties and office are optional; an empty column lists none. */
const optionalSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(80),
  v.transform((value) => (value.length > 0 ? value : null))
)
const rowSchema = v.object({
  studentId: studentIdSchema,
  displayName: displayNameSchema,
  bureau: optionalSchema,
  duties: v.pipe(
    v.string(),
    v.transform((value) =>
      value
        .split("|")
        .map((duty) => duty.trim())
        .filter((duty) => duty.length > 0)
    ),
    v.array(v.pipe(v.string(), v.maxLength(80))),
    v.maxLength(8)
  ),
  office: optionalSchema,
})

/** The listed year, from the CSV of `学籍番号,氏名[,局[,担当[,役職]]]`. */
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
    if (fields.length < 2 || fields.length > 5) {
      throw new Error(
        `Row ${index + 1} must have the student ID, the name, and optionally the bureau, duties and office: ${line}`
      )
    }
    const [studentId, displayName, bureau = "", duties = "", office = ""] =
      fields
    return v.parse(rowSchema, {
      studentId,
      displayName,
      bureau,
      duties,
      office,
    })
  })

const seen = new Set<string>()
for (const entry of entries) {
  if (seen.has(entry.studentId)) {
    throw new Error(`Duplicate student ID in the CSV: ${entry.studentId}`)
  }
  seen.add(entry.studentId)
  if (entry.duties.length > 0 && !entry.bureau) {
    throw new Error(`A duty needs a bureau: ${entry.studentId}`)
  }
}

/** Rows are keyed like the app's own: dashed UUIDs, not bare hex. */
const uuid =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || " +
  "lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || " +
  "lower(hex(randomblob(6)))"
const now = "unixepoch() * 1000"
const quote = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`
const bureauId = (bureau: string) =>
  `(SELECT id FROM bureaus WHERE year = ${operatingYear} AND lower(name) = lower(${quote(bureau)}))`

const bureauNames = [
  ...new Set(entries.flatMap((entry) => (entry.bureau ? [entry.bureau] : []))),
]
const dutyNames = [
  ...new Map(
    entries.flatMap((entry) =>
      entry.bureau
        ? entry.duties.map((duty) => {
            const bureau = entry.bureau ?? ""
            return [JSON.stringify([bureau, duty]), [bureau, duty]] as const
          })
        : []
    )
  ).values(),
]

// A bureau or duty already listed keeps its role; only new ones are added, and
// each is tied to the year role of the same name when the year has one.
const statements = [
  `-- ${entries.length} listings for ${operatingYear}, generated from ${inputPath}`,
  ...bureauNames.map(
    (bureau) => `INSERT INTO bureaus (id, year, name, role_id, created_at)
 VALUES (${uuid}, ${operatingYear}, ${quote(bureau)},
   (SELECT id FROM year_roles WHERE year = ${operatingYear} AND lower(name) = lower(${quote(bureau)})), ${now})
 ON CONFLICT (year, lower(name)) DO NOTHING;`
  ),
  ...dutyNames.map(
    ([
      bureau,
      duty,
    ]) => `INSERT INTO duties (id, bureau_id, name, role_id, created_at)
 VALUES (${uuid}, ${bureauId(bureau ?? "")}, ${quote(duty ?? "")},
   (SELECT id FROM year_roles WHERE year = ${operatingYear} AND lower(name) = lower(${quote(duty ?? "")})), ${now})
 ON CONFLICT (bureau_id, lower(name)) DO NOTHING;`
  ),
  ...entries.flatMap((entry) => {
    const listing = `(SELECT id FROM student_directory WHERE year = ${operatingYear} AND lower(student_id) = lower(${quote(entry.studentId)}))`
    return [
      `INSERT INTO student_directory (id, year, student_id, display_name, bureau_id, office, created_at)
 VALUES (${uuid}, ${operatingYear}, ${quote(entry.studentId)}, ${quote(entry.displayName)},
   ${entry.bureau ? bureauId(entry.bureau) : "NULL"}, ${quote(entry.office)}, ${now})
 ON CONFLICT (year, lower(student_id)) DO UPDATE SET
   display_name = excluded.display_name, bureau_id = excluded.bureau_id, office = excluded.office;`,
      // The listing decides the duties, so the ones it dropped go with it.
      `DELETE FROM directory_duties WHERE entry_id = ${listing};`,
      ...entry.duties.map(
        (duty) => `INSERT INTO directory_duties (entry_id, duty_id)
 VALUES (${listing}, (SELECT id FROM duties WHERE bureau_id = ${bureauId(entry.bureau ?? "")} AND lower(name) = lower(${quote(duty)})));`
      ),
    ]
  }),
]

writeFileSync(outputPath, `${statements.join("\n")}\n`)
console.info(`Wrote ${entries.length} directory entries to ${outputPath}`)

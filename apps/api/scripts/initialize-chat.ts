import { readFileSync, writeFileSync } from "node:fs"
import * as v from "valibot"
import {
  activityRoom,
  yearRoom,
  roomCommands,
} from "../src/services/chat-creation.ts"

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath)
  throw new Error("Specify input JSON and output SQL paths")
const input = v.parse(
  v.strictObject({
    createdBy: v.pipe(v.string(), v.uuid()),
    years: v.array(v.number()),
    activities: v.array(
      v.object({
        id: v.pipe(v.string(), v.uuid()),
        year: v.number(),
        name: v.string(),
        createdBy: v.pipe(v.string(), v.uuid()),
      })
    ),
  }),
  JSON.parse(readFileSync(inputPath, "utf8"))
)
const rooms = [
  ...input.years.map((year) => yearRoom(year, input.createdBy)),
  ...input.activities.map(activityRoom),
]
const quote = (value: string | number | null) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`
const commands = rooms
  .flatMap((room) => roomCommands(room, Date.now()))
  .map(({ sql, params }) => {
    let index = 0
    return (
      sql.replaceAll("?", () => {
        const value = params[index++]
        if (value === undefined) throw new Error("Missing parameter")
        return quote(value)
      }) + ";"
    )
  })
// A transactional guard refuses to initialize a populated installation.
writeFileSync(
  outputPath,
  [
    `CREATE TABLE _chat_initialization_guard (empty INTEGER NOT NULL CHECK(empty=1));`,
    `INSERT INTO _chat_initialization_guard SELECT NOT EXISTS(SELECT 1 FROM chat_rooms);`,
    ...commands,
    `DROP TABLE _chat_initialization_guard;`,
  ].join("\n")
)
console.log(`Prepared ${rooms.length} rooms`)

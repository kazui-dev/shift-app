import { expect, it } from "vite-plus/test"
import { remainingAssignment } from "../../src/features/shifts/domain/assignment-overwrite"

const at = (hour: number) => new Date(Date.UTC(2026, 10, 1, hour)).toISOString()
const window = (from: number, to: number) => ({
  startsAt: at(from),
  endsAt: at(to),
})
it.each([
  [[], [[9, 12]]],
  [
    [
      [8, 9],
      [12, 13],
    ],
    [[9, 12]],
  ],
  [[[8, 13]], []],
  [[[9, 12]], []],
  [[[8, 10]], [[10, 12]]],
  [[[11, 13]], [[9, 11]]],
  [
    [[10, 11]],
    [
      [9, 10],
      [11, 12],
    ],
  ],
  [
    [
      [11, 12],
      [9, 10],
    ],
    [[10, 11]],
  ],
  [
    [
      [10, 11],
      [9, 12],
    ],
    [],
  ],
])("subtracts intervals %j", (replacements, expected) => {
  expect(
    remainingAssignment(
      window(9, 12),
      replacements.map(([from = 0, to = 0]) => window(from, to))
    )
  ).toEqual(expected.map(([from = 0, to = 0]) => window(from, to)))
})

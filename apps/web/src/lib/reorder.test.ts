import { expect, it } from "vite-plus/test"
import { reorderVisibleRows } from "@workspace/ui/lib/reorder"
const roles = [
  { id: "locked", position: 100 },
  { id: "a", position: 30 },
  { id: "hidden", position: 20 },
  { id: "b", position: 10 },
]
const editable = (row: { position: number }) => row.position < 100
it("moves visible roles in either direction without moving hidden roles", () => {
  expect(reorderVisibleRows(roles, ["a", "b"], "a", "b", editable)).toEqual([
    "locked",
    "b",
    "hidden",
    "a",
  ])
  expect(reorderVisibleRows(roles, ["a", "b"], "b", "a", editable)).toEqual([
    "locked",
    "b",
    "hidden",
    "a",
  ])
  expect(
    reorderVisibleRows(
      roles,
      ["locked", "a", "hidden", "b"],
      "a",
      "b",
      editable
    )
  ).toEqual(["locked", "hidden", "b", "a"])
})
it("rejects missing, unchanged, unauthorized and malformed reorders", () => {
  expect(
    reorderVisibleRows(roles, ["a", "b"], "missing", "b", editable)
  ).toBeNull()
  expect(
    reorderVisibleRows(roles, ["a", "b"], "a", "missing", editable)
  ).toBeNull()
  expect(reorderVisibleRows(roles, ["a", "b"], "a", "a", editable)).toBeNull()
  expect(
    reorderVisibleRows(roles, ["locked", "a", "b"], "a", "locked", editable)
  ).toBeNull()
  expect(
    reorderVisibleRows(roles, ["a", "a", "b"], "a", "b", editable)
  ).toBeNull()
  expect(
    reorderVisibleRows(
      [...roles, { id: "a", position: 0 }],
      ["a", "b"],
      "a",
      "b",
      editable
    )
  ).toBeNull()
})

import { expect, it } from "vite-plus/test"
import { selectManagementYear } from "./year-selection"

const years = [
  { year: 2025, canManage: true },
  { year: 2026, canManage: true, isDefault: true },
  { year: 2027, canManage: false },
]

it("uses the saved manageable year and falls back to the default", () => {
  expect(selectManagementYear(years, 2025)).toBe(2025)
  expect(selectManagementYear(years, 2027)).toBe(2026)
  expect(selectManagementYear(years, null)).toBe(2026)
  expect(selectManagementYear([], null)).toBeNull()
})

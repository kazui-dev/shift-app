import { describe, it, expect } from "vite-plus/test"
import { resolveDisplayYear } from "../../src/domain/display-year"

describe("display year selection", () => {
  it.each([
    {
      years: [2027, 2026],
      defaultYear: 2026,
      selected: null,
      year: 2026,
      lost: false,
    },
    {
      years: [2027, 2026],
      defaultYear: 2027,
      selected: null,
      year: 2027,
      lost: false,
    },
    {
      years: [2027, 2026],
      defaultYear: 2027,
      selected: 2026,
      year: 2026,
      lost: false,
    },
    {
      years: [2026, 2025],
      defaultYear: 2027,
      selected: null,
      year: 2026,
      lost: false,
    },
    {
      years: [2026, 2025],
      defaultYear: null,
      selected: null,
      year: 2026,
      lost: false,
    },
    {
      years: [2026],
      defaultYear: 2026,
      selected: 2025,
      year: 2026,
      lost: true,
    },
    { years: [], defaultYear: 2026, selected: null, year: null, lost: false },
    { years: [], defaultYear: null, selected: 2025, year: null, lost: true },
  ])(
    "resolves $selected with default $defaultYear",
    ({ years, defaultYear, selected, year, lost }) => {
      expect(resolveDisplayYear(years, defaultYear, selected)).toEqual({
        year,
        years,
        defaultYear,
        unavailableSelection: lost,
      })
    }
  )
})

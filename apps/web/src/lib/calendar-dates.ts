export function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function dateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

export function moveDate(value: string, days: number): string {
  const next = localDate(value)
  next.setDate(next.getDate() + days)
  return dateValue(next)
}

export function weekStart(value: string): string {
  return moveDate(value, -localDate(value).getDay())
}

export function weekDates(value: string): string[] {
  const start = weekStart(value)
  return Array.from({ length: 7 }, (_, weekday) => moveDate(start, weekday))
}

export function moveMonth(
  value: string,
  months: number,
  preferredDay: number
): string {
  const current = localDate(value)
  current.setDate(1)
  current.setMonth(current.getMonth() + months)
  const lastDay = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate()
  current.setDate(Math.min(preferredDay, lastDay))
  return dateValue(current)
}

export function monthValue(date: string): string {
  return date.slice(0, 7)
}

export function moveMonthValue(value: string, months: number): string {
  return monthValue(moveMonth(`${value}-01`, months, 1))
}

export function monthValuesForDates(dates: string[]): string[] {
  return [...new Set(dates.map(monthValue))]
}

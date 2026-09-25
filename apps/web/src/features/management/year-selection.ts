type ManageableYear = {
  year: number
  canManage: boolean
  isDefault?: boolean
}

const key = (studentId: string) => `management-year:${studentId}`

export function savedManagementYear(studentId: string): number | null {
  try {
    const value = localStorage.getItem(key(studentId))
    return value ? Number(value) : null
  } catch {
    return null
  }
}

export function selectManagementYear(
  years: readonly ManageableYear[],
  saved: number | null
): number | null {
  const manageable = years.filter((item) => item.canManage)
  return (
    manageable.find((item) => item.year === saved)?.year ??
    manageable.find((item) => item.isDefault)?.year ??
    manageable[0]?.year ??
    null
  )
}

export function saveManagementYear(studentId: string, year: number | null) {
  try {
    if (year === null) localStorage.removeItem(key(studentId))
    else localStorage.setItem(key(studentId), String(year))
  } catch {
    /* Selection remains available in memory. */
  }
}

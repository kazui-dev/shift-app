import { yearsQuery } from "@/data/years"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { toast } from "@workspace/ui/lib/toast"

const route = getRouteApi("/_app")
export function useManagementYearState() {
  const { state } = route.useRouteContext()
  const key = `management-year:${state.member.studentId}`
  const query = useQuery({ ...yearsQuery })
  const [saved, setSaved] = useState<number | null>(() => {
    try {
      const value = localStorage.getItem(key)
      return value ? Number(value) : null
    } catch {
      return null
    }
  })
  const years = useMemo(
    () => query.data?.years.filter((item) => item.canManage) ?? [],
    [query.data]
  )
  const year =
    years.find((item) => item.year === saved)?.year ??
    years.find((item) => item.isDefault)?.year ??
    years[0]?.year ??
    null
  function selectYear(value: number | null) {
    setSaved(value)
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(value))
    } catch {
      /* Selection remains available in memory. */
    }
  }
  useEffect(() => {
    if (
      query.isSuccess &&
      saved !== null &&
      !years.some((item) => item.year === saved)
    ) {
      setSaved(null)
      try {
        localStorage.removeItem(key)
      } catch {
        /* Storage can be unavailable. */
      }
      toast.info("管理できる年度が変更されたため、年度を切り替えました。")
    }
  }, [query.isSuccess, saved, years, key])
  return { ...query, years, year, selectYear }
}

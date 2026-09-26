import { yearsQuery } from "@/features/years/data/years"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { toast } from "@workspace/ui/lib/toast"
import {
  savedManagementYear,
  saveManagementYear,
  selectManagementYear,
} from "@/features/management/year-selection"

const route = getRouteApi("/_app")
export function useManagementYearState() {
  const { state } = route.useRouteContext()
  const studentId = state.member.studentId
  const query = useQuery({ ...yearsQuery })
  const [saved, setSaved] = useState<number | null>(() =>
    savedManagementYear(studentId)
  )
  const years = useMemo(
    () => query.data?.years.filter((item) => item.canManage) ?? [],
    [query.data]
  )
  const year = selectManagementYear(years, saved)
  function selectYear(value: number | null) {
    setSaved(value)
    saveManagementYear(studentId, value)
  }
  useEffect(() => {
    if (
      query.isSuccess &&
      saved !== null &&
      !years.some((item) => item.year === saved)
    ) {
      setSaved(null)
      saveManagementYear(studentId, null)
      toast.info("管理できる年度が変更されたため、年度を切り替えました。")
    }
  }, [query.isSuccess, saved, years, studentId])
  return { ...query, years, year, selectYear }
}

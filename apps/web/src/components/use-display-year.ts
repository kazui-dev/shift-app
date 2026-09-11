import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "@workspace/ui/lib/toast"
import { getDisplayYear } from "@/api/years"

export function useDisplayYear() {
  const query = useQuery({
    queryKey: ["display-year"],
    queryFn: getDisplayYear,
  })
  const notified = useRef(false)
  useEffect(() => {
    if (query.data?.unavailableSelection && !notified.current) {
      toast.info("参加年度が変更されたため、表示年度を切り替えました。")
      notified.current = true
    }
  }, [query.data?.unavailableSelection])
  return { ...query, year: query.data?.year ?? null }
}

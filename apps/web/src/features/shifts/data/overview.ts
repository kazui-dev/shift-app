import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import { getShiftOverview } from "../api/overview"
export const overviewQuery = (year: number, date: string) =>
  queryOptions({
    queryKey: keys.shiftOverview(year, date),
    queryFn: () => getShiftOverview(year, date),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })

import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import { getYearTags } from "../api/tags"

export const tagsQuery = (year: number) =>
  queryOptions({
    queryKey: keys.yearTags(year),
    queryFn: () => getYearTags(year),
    staleTime: 60_000,
  })

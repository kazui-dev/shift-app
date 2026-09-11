import { queryOptions } from "@tanstack/react-query"
import { getActivities, getActivity } from "@/api/activities"
export const activitiesQuery = (year: number) =>
  queryOptions({
    queryKey: ["activities", year],
    queryFn: () => getActivities(year),
    staleTime: 60_000,
  })
export const activityQuery = (id: string) =>
  queryOptions({
    queryKey: ["activity-editor", id],
    queryFn: () => getActivity(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

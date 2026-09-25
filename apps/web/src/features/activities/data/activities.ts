import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import {
  getActivities,
  getActivity,
} from "@/features/activities/api/activities"
export const activitiesQuery = (year: number) =>
  queryOptions({
    queryKey: keys.activities(year),
    queryFn: () => getActivities(year),
    staleTime: 60_000,
  })
export const activityQuery = (id: string) =>
  queryOptions({
    queryKey: keys.activityEditor(id),
    queryFn: () => getActivity(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

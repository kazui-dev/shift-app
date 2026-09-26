import {
  queryOptions,
  skipToken,
  type QueryClient,
} from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import {
  getAvailability,
  getAvailabilityDates,
  getAvailabilitySubmissions,
} from "@/features/availability/api/availability"
/** The member's own form. Without a year there is nothing to ask for. */
export const availabilityQuery = (year: number | null) =>
  queryOptions({
    queryKey: keys.availability(year),
    queryFn: year === null ? skipToken : () => getAvailability(year),
    staleTime: 60_000,
  })
export const availabilityDatesQuery = (year: number) =>
  queryOptions({
    queryKey: keys.availabilityDates(year),
    queryFn: () => getAvailabilityDates(year),
    staleTime: 60_000,
  })
export const availabilitySubmissionsQuery = (year: number) =>
  queryOptions({
    queryKey: keys.availabilitySubmissions(year),
    queryFn: () => getAvailabilitySubmissions(year),
    staleTime: 30_000,
  })

export function refreshAvailability(client: QueryClient, year: number) {
  return Promise.all([
    client.invalidateQueries({ queryKey: keys.availabilityDates(year) }),
    client.invalidateQueries({ queryKey: keys.availability(year) }),
    client.invalidateQueries({ queryKey: keys.availabilitySubmissions(year) }),
  ])
}

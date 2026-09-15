import { queryOptions, skipToken } from "@tanstack/react-query"
import { keys } from "@/data/keys"
import {
  getAvailability,
  getAvailabilityDates,
  getAvailabilitySubmissions,
} from "@/api/availability"
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

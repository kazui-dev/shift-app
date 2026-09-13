import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/data/keys"
import {
  getAvailability,
  getAvailabilityDates,
  getAvailabilitySubmissions,
} from "@/api/availability"
export const availabilityQuery = (year: number) =>
  queryOptions({
    queryKey: keys.availability(year),
    queryFn: () => getAvailability(year),
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

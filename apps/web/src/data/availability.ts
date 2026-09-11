import { queryOptions } from "@tanstack/react-query"
import {
  getAvailability,
  getAvailabilityDates,
  getAvailabilitySubmissions,
} from "@/api/availability"
export const availabilityQuery = (year: number) =>
  queryOptions({
    queryKey: ["availability", year],
    queryFn: () => getAvailability(year),
    staleTime: 60_000,
  })
export const availabilityDatesQuery = (year: number) =>
  queryOptions({
    queryKey: ["availability-dates", year],
    queryFn: () => getAvailabilityDates(year),
    staleTime: 60_000,
  })
export const availabilitySubmissionsQuery = (year: number) =>
  queryOptions({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year),
    staleTime: 30_000,
  })

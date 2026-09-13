import { queryOptions } from "@tanstack/react-query"
import { keys } from "@/data/keys"
import {
  getDisplayYear,
  getYears,
  getRoster,
  getYearRoles,
  getYearMemberships,
} from "@/api/years"
export const displayYearQuery = queryOptions({
  queryKey: keys.displayYear(),
  queryFn: getDisplayYear,
  staleTime: 300_000,
})
export const yearsQuery = queryOptions({
  queryKey: keys.years(),
  queryFn: getYears,
  staleTime: 300_000,
})
export const rosterQuery = (year: number) =>
  queryOptions({
    queryKey: keys.roster(year),
    queryFn: () => getRoster(year),
    staleTime: 60_000,
  })
export const rolesQuery = (year: number) =>
  queryOptions({
    queryKey: keys.yearRoles(year),
    queryFn: () => getYearRoles(year),
    staleTime: 60_000,
  })
export const membershipsQuery = (year: number) =>
  queryOptions({
    queryKey: keys.yearMemberships(year),
    queryFn: () => getYearMemberships(year),
    staleTime: 60_000,
  })

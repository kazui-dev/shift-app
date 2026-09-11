import { queryOptions } from "@tanstack/react-query"
import {
  getDisplayYear,
  getYears,
  getRoster,
  getYearRoles,
  getYearMemberships,
} from "@/api/years"
export const displayYearQuery = queryOptions({
  queryKey: ["display-year"],
  queryFn: getDisplayYear,
  staleTime: 300_000,
})
export const yearsQuery = queryOptions({
  queryKey: ["years"],
  queryFn: getYears,
  staleTime: 300_000,
})
export const rosterQuery = (year: number) =>
  queryOptions({
    queryKey: ["roster", year],
    queryFn: () => getRoster(year),
    staleTime: 60_000,
  })
export const rolesQuery = (year: number) =>
  queryOptions({
    queryKey: ["year-roles", year],
    queryFn: () => getYearRoles(year),
    staleTime: 60_000,
  })
export const membershipsQuery = (year: number) =>
  queryOptions({
    queryKey: ["year-memberships", year],
    queryFn: () => getYearMemberships(year),
    staleTime: 60_000,
  })

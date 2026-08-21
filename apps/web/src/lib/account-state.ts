import { queryOptions } from "@tanstack/react-query"

import { getAccountState } from "@/api/account"

export const accountStateQueryOptions = queryOptions({
  queryKey: ["account"],
  queryFn: getAccountState,
  retry: false,
  meta: { persist: false },
})

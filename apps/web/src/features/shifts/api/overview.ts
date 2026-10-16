import { shiftOverviewResponseSchema } from "@workspace/shared/shifts"
import { apiJson } from "@/lib/http/client"
export const getShiftOverview = (year: number, date: string) =>
  apiJson(
    `/api/years/${year}/shift-overview?${new URLSearchParams({ date })}`,
    shiftOverviewResponseSchema
  )

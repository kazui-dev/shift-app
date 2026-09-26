import { Link } from "@tanstack/react-router"
import { useDisplayYear } from "./use-display-year"
export function DisplayYearNotice() {
  const { data } = useDisplayYear()
  if (!data?.year || data.year === data.defaultYear) return null
  return (
    <Link
      to="/settings"
      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
    >
      {data.year}年度を表示中
    </Link>
  )
}

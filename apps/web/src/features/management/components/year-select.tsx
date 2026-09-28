import { SelectField } from "@/components/select-field"
import { useManagement } from "@/features/management/management-context"

export function ManagementYearSelect({
  disabled = false,
}: {
  disabled?: boolean
}) {
  const { years } = useManagement()
  if (years.year === null) return null
  if (years.years.length === 1)
    return (
      <span className="flex min-h-10 items-center px-3 text-sm font-medium">
        {years.year}年度
      </span>
    )
  return (
    <SelectField
      aria-label="管理する年度"
      disabled={disabled}
      className="h-10 w-full text-sm"
      value={years.year}
      onValueChange={(value) => years.selectYear(Number(value))}
      options={years.years.map((item) => ({
        value: item.year,
        label: `${item.year}年度`,
      }))}
    />
  )
}

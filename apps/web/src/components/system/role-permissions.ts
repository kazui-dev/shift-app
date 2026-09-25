import type { ShiftPermission } from "@workspace/shared/shifts"

export const permissions: { value: ShiftPermission; label: string }[] = [
  { value: "shift.create", label: "シフト作成" },
  { value: "shift.manage", label: "全シフト管理" },
  { value: "member.manage", label: "メンバー管理" },
  { value: "role.manage", label: "ロール管理" },
]
export type Role = {
  id: string
  name: string
  color: string
  permissions: ShiftPermission[]
}

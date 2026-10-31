import { getRouteApi } from "@tanstack/react-router"
import { ManagementLabelPage } from "@/features/management/pages/label-page"
const createRoute = getRouteApi("/_app/manage/roles_/$year/new")
export function CreateRolePage() {
  const { year } = createRoute.useParams()
  return (
    <ManagementLabelPage
      key={`${year}:new`}
      kind="role"
      yearParam={year}
      id={null}
      mode="create"
    />
  )
}
const detailRoute = getRouteApi("/_app/manage/roles_/$year/$roleId")
export function DetailRolePage() {
  const { year, roleId } = detailRoute.useParams()
  return (
    <ManagementLabelPage
      key={`${year}:${roleId}:members`}
      kind="role"
      yearParam={year}
      id={roleId}
      mode="members"
    />
  )
}
const settingsRoute = getRouteApi("/_app/manage/roles_/$year/$roleId_/settings")
export function SettingsRolePage() {
  const { year, roleId } = settingsRoute.useParams()
  return (
    <ManagementLabelPage
      key={`${year}:${roleId}:settings`}
      kind="role"
      yearParam={year}
      id={roleId}
      mode="settings"
    />
  )
}

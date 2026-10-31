import { getRouteApi } from "@tanstack/react-router"
import { ManagementLabelPage } from "@/features/management/pages/label-page"
const createRoute = getRouteApi("/_app/manage/tags_/$year/new")
export function CreateTagPage() {
  const { year } = createRoute.useParams()
  return (
    <ManagementLabelPage
      key={`${year}:new`}
      kind="tag"
      yearParam={year}
      id={null}
      mode="create"
    />
  )
}
const detailRoute = getRouteApi("/_app/manage/tags_/$year/$tagId")
export function DetailTagPage() {
  const { year, tagId } = detailRoute.useParams()
  return (
    <ManagementLabelPage
      key={`${year}:${tagId}:members`}
      kind="tag"
      yearParam={year}
      id={tagId}
      mode="members"
    />
  )
}
const settingsRoute = getRouteApi("/_app/manage/tags_/$year/$tagId_/settings")
export function SettingsTagPage() {
  const { year, tagId } = settingsRoute.useParams()
  return (
    <ManagementLabelPage
      key={`${year}:${tagId}:settings`}
      kind="tag"
      yearParam={year}
      id={tagId}
      mode="settings"
    />
  )
}

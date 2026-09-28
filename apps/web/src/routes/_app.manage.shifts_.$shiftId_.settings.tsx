import { createFileRoute } from "@tanstack/react-router"
import { activityQuery } from "@/features/shifts/data/activities"
import { ShiftSettingsPage } from "@/features/shifts/pages/shift-settings-page"

export const Route = createFileRoute("/_app/manage/shifts_/$shiftId_/settings")(
  {
    loader: ({ context, params }) =>
      context.queryClient.ensureQueryData(activityQuery(params.shiftId)),
    pendingMs: Infinity,
    component: ShiftSettingsPage,
  }
)

import { createFileRoute } from "@tanstack/react-router"

import { MembersPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/members")({
  component: MembersPage,
})

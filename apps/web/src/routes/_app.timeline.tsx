import { createFileRoute } from "@tanstack/react-router"

import { TimelinePage } from "@/pages/timeline-page"

export const Route = createFileRoute("/_app/timeline")({
  component: TimelinePage,
})

import { createFileRoute } from "@tanstack/react-router"
export const Route = createFileRoute("/_app/chat/$roomId")({
  validateSearch: (
    search: Record<string, unknown>
  ): { report?: string | undefined } => ({
    report: typeof search.report === "string" ? search.report : undefined,
  }),
  component: () => null,
})

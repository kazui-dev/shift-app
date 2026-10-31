import { Button } from "@workspace/ui/components/button"
export function QueryError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => Promise<unknown>
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 py-4 text-sm"
    >
      <span>{message}</span>
      <Button size="sm" variant="outline" onClick={() => void onRetry()}>
        再読み込み
      </Button>
    </div>
  )
}

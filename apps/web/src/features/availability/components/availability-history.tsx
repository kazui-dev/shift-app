import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { availabilityHistoryQuery } from "../data/availability"

type Answer = {
  choice: "all" | "times" | "no" | "unanswered"
  times: { from: number; to: number }[]
}

const clock = (minute: number) =>
  `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`

function answerLabel(answer: Answer) {
  if (answer.choice === "unanswered") return "未回答"
  if (answer.choice === "all") return "終日参加"
  if (answer.choice === "no") return "不参加"
  return answer.times
    .map(({ from, to }) => `${clock(from)}〜${clock(to)}`)
    .join("、")
}

export function AvailabilityHistory({
  year,
  memberId,
  name,
  onClose,
}: {
  year: number
  memberId: string
  name: string
  onClose: () => void
}) {
  const history = useQuery(availabilityHistoryQuery(year, memberId))
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(80dvh,42rem)] overflow-y-auto">
        <DialogTitle>{name}さんの変更履歴</DialogTitle>
        {history.isPending && <p>読み込み中…</p>}
        {history.isError && (
          <Button variant="outline" onClick={() => void history.refetch()}>
            履歴を再読み込み
          </Button>
        )}
        {history.data?.changes.length === 0 && <p>変更履歴はありません。</p>}
        {history.data && history.data.changes.length > 0 && (
          <ol className="divide-y">
            {history.data.changes.map((change) => (
              <li key={change.id} className="space-y-1 py-3 first:pt-0">
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={change.changedAt}
                >
                  {new Date(change.changedAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                {change.changedByName && (
                  <p className="text-xs text-muted-foreground">
                    {change.changedByName}
                  </p>
                )}
                <p className="font-medium">
                  {change.date.slice(5).replace("-", "/")}
                </p>
                <p className="text-sm">
                  {answerLabel(change.before)} → {answerLabel(change.after)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}

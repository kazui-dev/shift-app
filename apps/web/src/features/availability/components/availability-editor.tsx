import { AvailabilityFields } from "./availability-fields"
import type { getAvailability } from "@/features/availability/api/availability"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsivePageHeader,
  ResponsivePageBody,
} from "@workspace/ui/components/responsive-page"
import { answerStatus } from "@/features/availability/components/answer-status"
import { useAvailabilityEditor } from "./use-availability-editor"

export function AvailabilityEditor({
  year,
  user,
  data,
  onClose,
}: {
  year: number
  user: string
  data: Awaited<ReturnType<typeof getAvailability>>
  onClose: () => void
}) {
  const editor = useAvailabilityEditor(
    user,
    year,
    data.dates,
    data.answers,
    data.submitted,
    data.draftRevision ?? data.revision ?? 0
  )
  const accepting = data.dates.filter((date) => date.accepting)
  const statuses = accepting.map((date) =>
    answerStatus(
      date,
      editor.answers.find((answer) => answer.date === date.date),
      editor.sent.find((answer) => answer.date === date.date)
    )
  )
  const complete =
    statuses.length > 0 && statuses.every((status) => status === "提出済み")
  const close = () => {
    if (!editor.submitting)
      void editor
        .save()
        .then(onClose)
        .catch(() => {})
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void editor.submit()
      }}
    >
      <ResponsivePageHeader
        title="シフト希望"
        onBack={close}
        backDisabled={editor.submitting}
        action={
          <Button
            type="submit"
            size="sm"
            disabled={
              editor.submitting ||
              editor.conflicted ||
              complete ||
              !accepting.length
            }
          >
            {editor.submitting ? "提出中" : complete ? "提出済み" : "提出"}
          </Button>
        }
      />
      <ResponsivePageBody>
        <AvailabilityFields
          dates={data.dates}
          answers={editor.answers}
          submitted={editor.sent}
          pending={editor.submitting || editor.conflicted}
          onUpdate={editor.update}
        />
      </ResponsivePageBody>
      <div className="flex h-12 shrink-0 items-center gap-2 px-5 pb-[env(safe-area-inset-bottom)]">
        <output
          className={`min-w-0 flex-1 text-xs ${editor.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {editor.error ?? editor.status}
        </output>
        {editor.conflicted && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={editor.submitting}
            onClick={() => void editor.reload()}
          >
            再読み込み
          </Button>
        )}
        {!editor.conflicted && editor.status === "保存できませんでした" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void editor.save().catch(() => {})}
          >
            再試行
          </Button>
        )}
      </div>
    </form>
  )
}

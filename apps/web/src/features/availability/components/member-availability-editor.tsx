import * as v from "valibot"
import { managedAnswersInputSchema } from "@workspace/shared/availability"
import { answerError } from "./answer-status"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { DayAnswer, FormDate } from "@workspace/shared/availability"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { keys } from "@/app/data/keys"
import { ApiError, errorMessage } from "@/lib/http/client"
import {
  getMemberAvailability,
  saveMemberAvailability,
} from "../api/availability"
import { refreshAvailability } from "../data/availability"
import { AvailabilityFields } from "./availability-fields"

type Form = Awaited<ReturnType<typeof getMemberAvailability>>
export function MemberAvailabilityEditor({
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
  const query = useQuery({
    queryKey: keys.memberAvailability(year, memberId),
    queryFn: () => getMemberAvailability(year, memberId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const [pending, setPending] = useState(false)
  const [generation, setGeneration] = useState(0)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        className="flex h-[min(85dvh,42rem)] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={!pending}
      >
        <header className="shrink-0 px-6 pt-6 pr-16 pb-4">
          <DialogTitle>{name}さんのシフト希望</DialogTitle>
        </header>
        {query.data ? (
          <MemberAnswers
            key={`${memberId}:${generation}`}
            year={year}
            memberId={memberId}
            initialData={query.data}
            pending={pending}
            setPending={setPending}
            onClose={onClose}
            reload={async () => {
              const result = await query.refetch()
              if (result.isSuccess) setGeneration((value) => value + 1)
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="min-h-0 flex-1 px-6 py-2"
              aria-live="polite"
              aria-busy={query.isPending}
            >
              {query.isPending && (
                <p className="text-sm text-muted-foreground">読み込み中…</p>
              )}
              {query.isError && (
                <Button variant="outline" onClick={() => void query.refetch()}>
                  再読み込み
                </Button>
              )}
            </div>
            <footer className="flex shrink-0 justify-end border-t px-6 py-4">
              <Button disabled>保存</Button>
            </footer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
function MemberAnswers({
  year,
  memberId,
  initialData,
  pending,
  setPending,
  onClose,
  reload,
}: {
  year: number
  memberId: string
  initialData: Form
  pending: boolean
  setPending: (value: boolean) => void
  onClose: () => void
  reload: () => Promise<unknown>
}) {
  const [data] = useState(initialData)
  const client = useQueryClient()
  const [answers, setAnswers] = useState(data.submitted)
  const [error, setError] = useState<string | null>(null)
  const [conflicted, setConflicted] = useState(false)
  function update(
    date: FormDate,
    choice: DayAnswer["choice"],
    times?: DayAnswer["times"]
  ) {
    setAnswers((current) => [
      ...current.filter((answer) => answer.date !== date.date),
      {
        date: date.date,
        version: date.version,
        choice,
        times: times ??
          current.find((answer) => answer.date === date.date)?.times ?? [
            {
              id: crypto.randomUUID(),
              from: date.startsMinute,
              to: date.endsMinute,
            },
          ],
      },
    ])
  }
  async function save() {
    const input = v.safeParse(managedAnswersInputSchema, {
      answers,
      revision: data.revision,
    })
    const invalid = answerError(
      data.dates
        .filter((date) => answers.some((answer) => answer.date === date.date))
        .map((date) => ({ ...date, accepting: true })),
      answers
    )
    if (!input.success || invalid) {
      setError(invalid ?? "回答を確認してください。")
      return
    }
    setPending(true)
    setError(null)
    try {
      await saveMemberAvailability(year, memberId, {
        answers,
        revision: data.revision,
      })
      await refreshAvailability(client, year)
      onClose()
    } catch (failure) {
      setError(errorMessage(failure))
      setConflicted(failure instanceof ApiError && failure.status === 409)
    } finally {
      setPending(false)
    }
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="relative min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain px-6 py-2">
        <AvailabilityFields
          dates={data.dates}
          answers={answers}
          submitted={data.submitted}
          pending={pending || conflicted}
          allowClosed
          onUpdate={update}
        />
      </div>
      <footer className="shrink-0 border-t px-6 py-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {conflicted && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void reload()}
            >
              再読み込み
            </Button>
          )}
          <Button
            type="submit"
            disabled={pending || conflicted || !answers.length}
          >
            {pending ? "保存中" : "保存"}
          </Button>
        </div>
      </footer>
    </form>
  )
}

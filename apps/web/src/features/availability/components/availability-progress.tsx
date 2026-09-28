import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { SelectField } from "@/components/select-field"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import { notifyAvailability } from "../api/availability"
import { availabilitySubmissionsQuery } from "../data/availability"

export function AvailabilityProgress({
  year,
  pending,
  run,
}: {
  year: number
  pending: boolean
  run: (action: () => Promise<unknown>) => Promise<void>
}) {
  const submissions = useQuery(availabilitySubmissionsQuery(year))
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const progress = submissions.data?.progress ?? []
  const filtered = progress.filter(
    (item) =>
      `${item.displayName} ${item.studentId}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "" ||
        (status === "complete" ? item.complete : !item.complete))
  )
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          提出状況{" "}
          <span className="ml-2 font-normal text-muted-foreground">
            {progress.filter((item) => item.complete).length} /{" "}
            {progress.length}人提出済み
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={
            pending ||
            !submissions.data?.progress.some((item) => !item.complete)
          }
          onClick={() =>
            void run(async () => {
              await notifyAvailability(year, "incomplete")
              toast.success("未提出のメンバーに通知しました。")
            })
          }
        >
          <Bell />
          未提出者に通知
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-40 flex-1"
          aria-label="提出状況を検索"
          placeholder="名前・学籍番号で検索"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          aria-label="提出状況で絞り込み"
          className="w-auto"
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "", label: "全員" },
            { value: "incomplete", label: "未提出" },
            { value: "complete", label: "提出済み" },
          ]}
        />
      </div>
      {submissions.isPending && (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      )}
      {submissions.isError ? (
        <Button variant="outline" onClick={() => void submissions.refetch()}>
          提出状況を再読み込み
        </Button>
      ) : (
        <ul className="divide-y border-y">
          {filtered.map((item) => (
            <li key={item.memberId} className="flex items-center gap-3 py-3">
              <MemberAvatar name={item.displayName} image={item.image} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.displayName}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.complete ? "提出済み" : "未提出"}
              </span>
            </li>
          ))}
          {!submissions.isPending && filtered.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              条件に一致するメンバーはいません
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

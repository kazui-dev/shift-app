import { useMemo, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/lib/api"
import {
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncements,
} from "@/lib/communications-api"
import {
  cancelAssignment,
  createActivity,
  createAssignment,
  getActivities,
  getActivity,
  getAssignmentReports,
  getAvailabilitySubmissions,
  getYearMembers,
  getYears,
  resolveAssignmentReport,
} from "@/lib/shifts-api"

function iso(local: string): string {
  return new Date(local).toISOString()
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function ManagePage() {
  const queryClient = useQueryClient()
  const years = useQuery({ queryKey: ["years"], queryFn: getYears })
  const manageableYears = useMemo(
    () => years.data?.years.filter((year) => year.canManage) ?? [],
    [years.data]
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const year = selectedYear ?? manageableYears[0]?.year ?? null
  const activities = useQuery({
    queryKey: ["activities", year],
    queryFn: () => getActivities(year!),
    enabled: year !== null,
  })
  const members = useQuery({
    queryKey: ["year-members", year],
    queryFn: () => getYearMembers(year!),
    enabled: year !== null,
  })
  const submissions = useQuery({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year!),
    enabled: year !== null,
  })
  const reports = useQuery({
    queryKey: ["assignment-reports", year],
    queryFn: () => getAssignmentReports(year!),
    enabled: year !== null,
  })
  const announcements = useQuery({
    queryKey: ["announcements", year],
    queryFn: () => getAnnouncements(year!),
    enabled: year !== null,
  })
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const activity = useQuery({
    queryKey: ["activity", selectedActivity],
    queryFn: () => getActivity(selectedActivity!),
    enabled: selectedActivity !== null,
  })

  const [name, setName] = useState("")
  const [place, setPlace] = useState("")
  const [activityType, setActivityType] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [color, setColor] = useState("#2563EB")
  const [memberId, setMemberId] = useState("")
  const [notes, setNotes] = useState("")
  const [announcementTitle, setAnnouncementTitle] = useState("")
  const [announcementBody, setAnnouncementBody] = useState("")
  const [announcementPriority, setAnnouncementPriority] = useState<
    "normal" | "important"
  >("normal")
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState("")
  const [pending, setPending] = useState<
    "activity" | "assignment" | "cancel" | null
  >(null)
  const [message, setMessage] = useState<string | null>(null)

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (year === null) return
    setPending("activity")
    setMessage(null)
    try {
      await createActivity(year, {
        name,
        place,
        activityType,
        startsAt: iso(startsAt),
        endsAt: iso(endsAt),
        color,
        notes: notes.trim() || null,
      })
      setName("")
      setPlace("")
      setActivityType("")
      setStartsAt("")
      setEndsAt("")
      setNotes("")
      await queryClient.invalidateQueries({ queryKey: ["activities", year] })
      setMessage("活動を作成しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedActivity || !memberId) return
    setPending("assignment")
    setMessage(null)
    try {
      const result = await createAssignment(selectedActivity, {
        memberId,
        notes: notes.trim() || null,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["activity", selectedActivity],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities", year] }),
      ])
      setMessage(
        result.warnings.includes("OUTSIDE_SUBMITTED_AVAILABILITY")
          ? "割り当てました（提出希望時間外です）。"
          : "割り当てました。"
      )
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (!window.confirm("この割当を取り消しますか？")) return
    setPending("cancel")
    setMessage(null)
    try {
      await cancelAssignment(assignmentId)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["activity", selectedActivity],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities", year] }),
        queryClient.invalidateQueries({ queryKey: ["timeline"] }),
      ])
      setMessage("割当を取り消しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function resolveReport(reportId: string) {
    setPending("cancel")
    setMessage(null)
    try {
      await resolveAssignmentReport(reportId)
      await queryClient.invalidateQueries({
        queryKey: ["assignment-reports", year],
      })
      setMessage("連絡を対応済みにしました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (year === null) return
    setPending("activity")
    setMessage(null)
    try {
      await createAnnouncement(year, {
        title: announcementTitle,
        body: announcementBody,
        priority: announcementPriority,
        expiresAt: announcementExpiresAt ? iso(announcementExpiresAt) : null,
      })
      setAnnouncementTitle("")
      setAnnouncementBody("")
      setAnnouncementPriority("normal")
      setAnnouncementExpiresAt("")
      await queryClient.invalidateQueries({
        queryKey: ["announcements", year],
      })
      setMessage("お知らせを公開しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function removeAnnouncement(announcementId: string) {
    setPending("cancel")
    setMessage(null)
    try {
      await archiveAnnouncement(announcementId)
      await queryClient.invalidateQueries({
        queryKey: ["announcements", year],
      })
      setMessage("お知らせを終了しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  if (years.isPending) return <LoaderCircle className="animate-spin" />
  if (manageableYears.length === 0) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-medium">シフト管理</h1>
        <p className="rounded-lg border p-4 text-muted-foreground">
          シフトを管理できる年度がありません。
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">希望と割当</p>
          <h1 className="text-xl font-medium">シフト管理</h1>
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={year ?? ""}
          onChange={(event) => {
            setSelectedYear(Number(event.target.value))
            setSelectedActivity(null)
          }}
        >
          {manageableYears.map((item) => (
            <option key={item.year} value={item.year}>
              {item.year}
            </option>
          ))}
        </select>
      </div>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">活動を作成</summary>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addActivity}>
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="活動名"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="場所"
            required
            value={place}
            onChange={(event) => setPlace(event.target.value)}
          />
          <input
            className="h-10 rounded-md border bg-background px-3"
            placeholder="種別"
            required
            value={activityType}
            onChange={(event) => setActivityType(event.target.value)}
          />
          <input
            type="color"
            className="h-10 w-full rounded-md border bg-background px-1"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
          <label className="text-xs">
            開始
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              required
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label className="text-xs">
            終了
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              required
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <textarea
            className="min-h-20 rounded-md border bg-background p-3 sm:col-span-2"
            placeholder="備考（任意）"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <Button className="sm:col-span-2" disabled={pending !== null}>
            {pending === "activity" && (
              <LoaderCircle className="animate-spin" />
            )}
            作成
          </Button>
        </form>
      </details>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-medium">活動</h2>
          {activities.isPending && <LoaderCircle className="animate-spin" />}
          {activities.data?.activities.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-lg border p-3 text-left ${selectedActivity === item.id ? "border-foreground" : ""}`}
              onClick={() => setSelectedActivity(item.id)}
            >
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {dateTime(item.startsAt)}–{dateTime(item.endsAt)} · {item.place}{" "}
                · {item.assignmentCount}人
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="font-medium">割当</h2>
          {!selectedActivity && (
            <p className="text-sm text-muted-foreground">
              活動を選択してください。
            </p>
          )}
          {activity.isPending && <LoaderCircle className="animate-spin" />}
          {activity.data && (
            <>
              <form className="flex gap-2" onSubmit={addAssignment}>
                <select
                  className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2"
                  required
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                >
                  <option value="">メンバーを選択</option>
                  {members.data?.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}（{member.studentId}）
                    </option>
                  ))}
                </select>
                <Button disabled={pending !== null}>
                  {pending === "assignment" && (
                    <LoaderCircle className="animate-spin" />
                  )}
                  割当
                </Button>
              </form>
              <ul className="space-y-2">
                {activity.data.assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <div>
                      <p>{assignment.memberDisplayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateTime(assignment.startsAt)}–
                        {dateTime(assignment.endsAt)}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending !== null}
                      onClick={() => void removeAssignment(assignment.id)}
                    >
                      <Trash2 />
                      <span className="sr-only">取消</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">
          希望提出状況（{submissions.data?.submissions.length ?? 0}件）
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {submissions.data?.submissions.map((submission) => (
            <li key={submission.id} className="border-b pb-2">
              {submission.member.displayName} ·{" "}
              {submission.status === "submitted" ? "提出済み" : "下書き"} ·{" "}
              {submission.windows.length}枠
            </li>
          ))}
        </ul>
      </details>
      <details className="rounded-lg border p-4" open>
        <summary className="cursor-pointer font-medium">
          遅刻・欠勤連絡（
          {reports.data?.reports.filter((report) => report.status === "open")
            .length ?? 0}
          件未対応）
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {reports.data?.reports.map((report) => (
            <li key={report.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {report.kind === "late" ? "遅刻" : "欠勤"} ·{" "}
                    {report.memberDisplayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.activityName} · {dateTime(report.startsAt)}
                  </p>
                  <p className="mt-2">{report.message}</p>
                </div>
                {report.status === "open" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() => void resolveReport(report.id)}
                  >
                    対応済み
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    対応済み
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </details>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">事務連絡</summary>
        <form className="mt-3 grid gap-2" onSubmit={publishAnnouncement}>
          <input
            className="h-10 rounded-md border bg-background px-3"
            maxLength={120}
            placeholder="件名"
            required
            value={announcementTitle}
            onChange={(event) => setAnnouncementTitle(event.target.value)}
          />
          <textarea
            className="min-h-24 rounded-md border bg-background p-3"
            maxLength={5000}
            placeholder="連絡内容"
            required
            value={announcementBody}
            onChange={(event) => setAnnouncementBody(event.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="h-10 rounded-md border bg-background px-2"
              value={announcementPriority}
              onChange={(event) =>
                setAnnouncementPriority(
                  event.target.value as "normal" | "important"
                )
              }
            >
              <option value="normal">通常</option>
              <option value="important">重要</option>
            </select>
            <label className="text-xs">
              掲載期限（任意）
              <input
                type="datetime-local"
                className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={announcementExpiresAt}
                onChange={(event) =>
                  setAnnouncementExpiresAt(event.target.value)
                }
              />
            </label>
          </div>
          <Button disabled={pending !== null}>公開</Button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {announcements.data?.announcements.map((announcement) => (
            <li
              key={announcement.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{announcement.title}</p>
                <p className="line-clamp-2 text-muted-foreground">
                  {announcement.body}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending !== null}
                onClick={() => void removeAnnouncement(announcement.id)}
              >
                終了
              </Button>
            </li>
          ))}
        </ul>
      </details>
      {message && <p className="text-sm">{message}</p>}
    </section>
  )
}

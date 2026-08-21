import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/api/client"
import {
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncements,
} from "@/api/communications"

function iso(local: string): string {
  return new Date(local).toISOString()
}

export function AnnouncementManager({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const announcements = useQuery({
    queryKey: ["announcements", year],
    queryFn: () => getAnnouncements(year),
  })
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<"normal" | "important">("normal")
  const [expiresAt, setExpiresAt] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await createAnnouncement(year, {
        title,
        body,
        priority,
        expiresAt: expiresAt ? iso(expiresAt) : null,
      })
      setTitle("")
      setBody("")
      setPriority("normal")
      setExpiresAt("")
      await queryClient.invalidateQueries({ queryKey: ["announcements", year] })
      setMessage("お知らせを公開しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function archive(announcementId: string) {
    setPending(true)
    setMessage(null)
    try {
      await archiveAnnouncement(announcementId)
      await queryClient.invalidateQueries({ queryKey: ["announcements", year] })
      setMessage("お知らせを終了しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-medium">事務連絡</summary>
      <form className="mt-3 grid gap-2" onSubmit={publish}>
        <input
          className="h-10 rounded-md border bg-background px-3"
          maxLength={120}
          placeholder="件名"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="min-h-24 rounded-md border bg-background p-3"
          maxLength={5000}
          placeholder="連絡内容"
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="h-10 rounded-md border bg-background px-2"
            value={priority}
            onChange={(event) => {
              const value = event.target.value
              if (value === "normal" || value === "important") {
                setPriority(value)
              }
            }}
          >
            <option value="normal">通常</option>
            <option value="important">重要</option>
          </select>
          <label className="text-xs">
            掲載期限（任意）
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>
        </div>
        <Button disabled={pending}>公開</Button>
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
              disabled={pending}
              onClick={() => void archive(announcement.id)}
            >
              終了
            </Button>
          </li>
        ))}
      </ul>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </details>
  )
}

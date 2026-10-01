import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import { AvailabilityProgress } from "./availability-progress"
import { AvailabilityFields } from "./availability-fields"

it("renders both submission states and history as matching buttons, retaining empty history positions", () => {
  const client = new QueryClient()
  client.setQueryData(keys.availabilitySubmissions(2026), {
    submissions: [],
    progress: [
      {
        memberId: "one",
        displayName: "提出者",
        studentId: "1",
        image: null,
        complete: true,
        hasHistory: true,
      },
      {
        memberId: "two",
        displayName: "未提出者",
        studentId: "2",
        image: null,
        complete: false,
        hasHistory: false,
      },
    ],
  })
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AvailabilityProgress year={2026} pending={false} run={async () => {}} />
    </QueryClientProvider>
  )
  const buttons = [
    ...html.matchAll(/<button\b[^>]*>(提出済み|未提出|履歴)<\/button>/g),
  ].map((match) => match[0])
  expect(buttons).toHaveLength(4)
  for (const button of buttons) {
    expect(button).toContain('data-variant="outline"')
    expect(button).toContain('data-size="sm"')
  }
  expect(buttons[0]).not.toContain('disabled=""')
  expect(buttons[2]).not.toContain('disabled=""')
  expect(buttons[3]).toContain('disabled=""')
  client.clear()
})
it("allows editing a closed day only in the member editing form", () => {
  const props = {
    dates: [
      {
        date: "2026-10-29",
        version: 1,
        startsMinute: 540,
        endsMinute: 1080,
        accepting: false,
      },
    ],
    answers: [],
    submitted: [],
    pending: false,
    onUpdate: () => {},
  }
  const self = renderToStaticMarkup(<AvailabilityFields {...props} />)
  const managed = renderToStaticMarkup(
    <AvailabilityFields {...props} allowClosed />
  )
  expect(self).toMatch(/<fieldset[^>]*disabled=""/)
  expect(managed).not.toMatch(/<fieldset[^>]*disabled=""/)
  expect(managed).not.toContain("管理者")
})

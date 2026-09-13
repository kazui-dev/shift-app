import { messageLinks } from "@workspace/shared/communications"
export function MessageText({ content }: { content: string }) {
  return messageLinks(content).map((part) =>
    part.href ? (
      <a
        key={part.offset}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline decoration-blue-600/40 underline-offset-2 select-text dark:text-blue-400"
      >
        {part.text}
      </a>
    ) : (
      part.text
    )
  )
}

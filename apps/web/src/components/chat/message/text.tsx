import { messageLinks } from "@workspace/shared/messages"
export function MessageText({ content }: { content: string }) {
  return messageLinks(content).map((part) =>
    part.href ? (
      <a
        key={part.offset}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 decoration-blue-600/40 underline-offset-2 select-text hover:underline focus-visible:underline dark:text-blue-500 dark:decoration-blue-500/40"
      >
        {part.text}
      </a>
    ) : (
      part.text
    )
  )
}

export function chatRoomId(pathname: string): string | undefined {
  return /^\/chat\/((?!new$)[^/]+)$/.exec(pathname)?.[1]
}

export function chatRoomId(pathname: string): string | undefined {
  return /^\/chat\/((?!new(?:\/|$))[^/]+)(?:\/settings)?$/.exec(pathname)?.[1]
}

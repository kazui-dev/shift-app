export function chatRoomId(pathname: string): string | undefined {
  return /^\/chat\/((?!new(?:\/|$))[^/]+)(?:\/info(?:\/settings)?)?$/.exec(
    pathname
  )?.[1]
}

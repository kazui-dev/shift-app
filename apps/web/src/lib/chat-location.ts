export function chatRoomId(pathname: string): string | undefined {
  return /^\/chat\/((?!new(?:\/|$))[^/]+)(?:\/(?:search|info(?:\/settings)?))?$/.exec(
    pathname
  )?.[1]
}

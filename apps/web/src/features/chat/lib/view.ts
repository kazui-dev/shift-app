const memory = new Map<string, string>()
const key = (member: string, year: number) => `chat-view:${member}:${year}`

export function saveChatView(member: string, year: number, roomId: string) {
  const storageKey = key(member, year)
  memory.set(storageKey, roomId)
  try {
    sessionStorage.setItem(storageKey, roomId)
  } catch {
    // Navigation still remembers the room when browser storage is unavailable.
  }
}

export function restoreChatView(
  member: string,
  year: number,
  rooms: readonly { id: string }[]
) {
  const storageKey = key(member, year)
  let saved = memory.get(storageKey)
  try {
    saved = sessionStorage.getItem(storageKey) ?? saved
  } catch {
    // Use the in-memory selection.
  }
  return rooms.find((room) => room.id === saved)?.id ?? rooms[0]?.id
}

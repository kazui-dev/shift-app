/** A device to notify, with the member it belongs to. */
export type RoomDevice = {
  memberId: string
  /** The member muted the room; only notices that must ring reach it. */
  muted: boolean
  id: string
  endpoint: string
  expirationTime: number | null
  p256dh: string
  auth: string
}

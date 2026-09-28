// Campus map linked from https://www.dendai.ac.jp/access/tokyo_senju.html.
// This is an approximate campus check, not proof of attendance.
const campus = { latitude: 35.748097, longitude: 139.806122 }
const radiusMetres = 300
/** Fixes less certain than this cannot tell whether someone is on campus. */
const accuracyMetres = 150

/**
 * Where a check-in stands on location: on campus, or why that could not be
 * confirmed — location not allowed, a fix away from campus, or no usable fix.
 */
export type CampusLocation = "confirmed" | "denied" | "far" | "unavailable"

export function campusFix(
  latitude: number,
  longitude: number,
  accuracy: number
): Exclude<CampusLocation, "denied"> {
  if (
    ![latitude, longitude, accuracy].every(Number.isFinite) ||
    accuracy < 0 ||
    accuracy > accuracyMetres
  )
    return "unavailable"
  const radians = Math.PI / 180
  const latitudeDelta = (latitude - campus.latitude) * radians
  const longitudeDelta = (longitude - campus.longitude) * radians
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude * radians) *
      Math.cos(campus.latitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return distance <= radiusMetres ? "confirmed" : "far"
}

/** Asks for one fresh location fix and says where the check-in stands. */
export function checkCampusLocation(): Promise<CampusLocation> {
  if (!navigator.geolocation) return Promise.resolve("unavailable")
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve(campusFix(coords.latitude, coords.longitude, coords.accuracy)),
      // 1 is PERMISSION_DENIED; a timeout or no position gives no usable fix.
      (error) => resolve(error.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

// Campus map linked from https://www.dendai.ac.jp/access/tokyo_senju.html.
// This is an approximate campus check, not proof of attendance.
const campus = { latitude: 35.748097, longitude: 139.806122 }
const radiusMetres = 300

export function isNearCampus(
  latitude: number,
  longitude: number,
  accuracy: number
) {
  if (
    ![latitude, longitude, accuracy].every(Number.isFinite) ||
    accuracy < 0 ||
    accuracy > 150
  )
    return false
  const radians = Math.PI / 180
  const latitudeDelta = (latitude - campus.latitude) * radians
  const longitudeDelta = (longitude - campus.longitude) * radians
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude * radians) *
      Math.cos(campus.latitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2
  return (
    6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMetres
  )
}

export function confirmCampusLocation(): Promise<boolean> {
  if (!navigator.geolocation) return Promise.resolve(false)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve(
          isNearCampus(coords.latitude, coords.longitude, coords.accuracy)
        ),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

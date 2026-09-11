import { describe, expect, it, vi, afterEach } from "vite-plus/test"
import { confirmCampusLocation, isNearCampus } from "./campus-location"

afterEach(() => vi.unstubAllGlobals())
describe("campus location check", () => {
  it("accepts a precise fix within Senju campus and rejects distant fixes", () => {
    expect(isNearCampus(35.748097, 139.806122, 30)).toBe(true)
    expect(isNearCampus(35.749, 139.806, 50)).toBe(true)
    expect(isNearCampus(35.74, 139.8, 30)).toBe(false)
  })
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 151])(
    "does not treat uncertain accuracy %s as confirmation",
    (accuracy) => {
      expect(isNearCampus(35.748097, 139.806122, accuracy)).toBe(false)
    }
  )
  it("falls back when geolocation is unavailable", async () => {
    vi.stubGlobal("navigator", {})
    expect(await confirmCampusLocation()).toBe(false)
  })
  it("requests a fresh single fix only on invocation", async () => {
    const getCurrentPosition = vi.fn<(success: PositionCallback) => void>(
      (success) =>
        success({
          coords: {
            latitude: 35.748097,
            longitude: 139.806122,
            accuracy: 20,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: 0,
          toJSON: () => ({}),
        })
    )
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } })
    expect(await confirmCampusLocation()).toBe(true)
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
  it("continues with responsible confirmation on permission denial", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, failure: () => void) =>
          failure(),
      },
    })
    expect(await confirmCampusLocation()).toBe(false)
  })
})

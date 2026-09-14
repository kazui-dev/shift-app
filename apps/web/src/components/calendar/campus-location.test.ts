import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import {
  campusFix,
  checkCampusLocation,
} from "@/components/calendar/campus-location"

afterEach(() => vi.unstubAllGlobals())

const position = (latitude: number, longitude: number, accuracy: number) => ({
  coords: {
    latitude,
    longitude,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: 0,
  toJSON: () => ({}),
})

describe("campus location check", () => {
  it("confirms a precise fix within Senju campus and tells distant fixes apart", () => {
    expect(campusFix(35.748097, 139.806122, 30)).toBe("confirmed")
    expect(campusFix(35.749, 139.806, 50)).toBe("confirmed")
    expect(campusFix(35.74, 139.8, 30)).toBe("far")
  })
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 151])(
    "does not treat uncertain accuracy %s as a usable fix",
    (accuracy) => {
      expect(campusFix(35.748097, 139.806122, accuracy)).toBe("unavailable")
    }
  )
  it("has no usable fix when geolocation is unavailable", async () => {
    vi.stubGlobal("navigator", {})
    expect(await checkCampusLocation()).toBe("unavailable")
  })
  it("requests a fresh single fix only on invocation", async () => {
    const getCurrentPosition = vi.fn<(success: PositionCallback) => void>(
      (success) => success(position(35.748097, 139.806122, 20))
    )
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } })
    expect(await checkCampusLocation()).toBe("confirmed")
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "unavailable"],
  ] as const)("reads failure code %s as %s", async (code, expected) => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _success: PositionCallback,
          failure: (error: { code: number }) => void
        ) => failure({ code }),
      },
    })
    expect(await checkCampusLocation()).toBe(expected)
  })
})

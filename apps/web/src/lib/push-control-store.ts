import { ApiError } from "@/api/client"
import { createPushDevice, getPushDevice, updatePushDevice } from "@/api/push"
import { prepareBrowserPush, pushSupported } from "./push-browser"
import {
  emptyPushState,
  PushController,
  PushError,
  type PushState,
} from "./push-controller"
import { readPushDeviceId, savePushDeviceId } from "./push-device-storage"
import { recordPushStep } from "./push-diagnostics"

const listeners = new Set<() => void>()
let controller: PushController | null = null
let initial: PushState = emptyPushState
let preparation: Promise<void> | null = null
let owner: string | null = null
let generation = 0
const changed = () => {
  for (const listener of listeners) listener()
}
export const getPushControlState = () => controller?.snapshot() ?? initial
export function subscribePushControl(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function preparePushControl(memberId: string): Promise<void> {
  if (!pushSupported()) return Promise.resolve()
  if (owner === memberId && controller) return controller.refresh()
  if (owner === memberId && preparation) return preparation
  controller?.dispose()
  controller = null
  owner = memberId
  const revision = ++generation
  initial = emptyPushState
  changed()
  const previousPreparation = preparation
  const task = async () => {
    await previousPreparation
    if (generation !== revision) return
    try {
      const browser = await prepareBrowserPush()
      if (generation !== revision) return
      const stored = readPushDeviceId()
      if (stored && stored.owner !== memberId) await browser.unsubscribe()
      let device = null
      if (stored?.owner === memberId) {
        try {
          device = await getPushDevice(stored.id)
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 404) throw error
        }
      }
      if (!device) {
        const observed = await browser.read()
        device = await createPushDevice(observed.subscription?.endpoint ?? null)
      }
      if (generation !== revision) return
      savePushDeviceId(memberId, device.id)
      const id = device.id
      controller = new PushController(
        {
          browser,
          record: recordPushStep,
          read: () => getPushDevice(id),
          save: (value) => updatePushDevice(id, value),
        },
        device,
        changed
      )
      changed()
      await controller.refresh()
    } catch (cause) {
      if (generation !== revision) return
      recordPushStep("prepare-failed", cause)
      initial = { ...emptyPushState, error: new PushError("prepare", cause) }
      changed()
    }
  }
  const current = task().finally(() => {
    if (preparation === current) preparation = null
  })
  preparation = current
  return current
}
export const refreshPushControl = () =>
  controller?.refresh() ??
  (owner ? preparePushControl(owner) : Promise.resolve())
export function setPushEnabled(enabled: boolean): Promise<void> {
  recordPushStep(enabled ? "enable-tap" : "disable-tap")
  return (
    controller?.setEnabled(enabled) ??
    Promise.reject(new PushError("prepare", new Error("Not ready")))
  )
}

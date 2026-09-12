import type {
  PushDevice,
  PushDeviceUpdate,
} from "@workspace/shared/communications"
import type { BrowserPush } from "./push-browser"

export type PushStage = "prepare" | "subscribe" | "save" | "refresh"
export class PushError extends Error {
  readonly stage: PushStage
  constructor(stage: PushStage, cause: unknown) {
    super(
      stage === "subscribe"
        ? "通知の購読を開始できませんでした。"
        : "通知設定を保存・確認できませんでした。",
      { cause }
    )
    this.name = "PushError"
    this.stage = stage
  }
}
export type PushState = {
  device: PushDevice | null
  enabled: boolean | null
  permission: NotificationPermission | null
  hasSubscription: boolean | null
  pending: boolean
  error: PushError | null
}
export const emptyPushState: PushState = {
  device: null,
  enabled: null,
  permission: null,
  hasSubscription: null,
  pending: false,
  error: null,
}
type Dependencies = {
  record?: (stage: string, error?: unknown) => void
  browser: BrowserPush
  read: () => Promise<PushDevice>
  save: (input: PushDeviceUpdate) => Promise<PushDevice>
}
export class PushController {
  private dependencies: Dependencies
  private changed: () => void
  private state: PushState
  private revision = 0
  private queue: Promise<void> = Promise.resolve()
  private subscription: ReturnType<BrowserPush["subscribe"]> | null = null
  private disposed = false
  constructor(
    dependencies: Dependencies,
    device: PushDevice,
    changed: () => void
  ) {
    this.dependencies = dependencies
    this.changed = changed
    this.state = { ...emptyPushState, device, enabled: device.enabled }
  }
  snapshot = () => this.state
  dispose() {
    this.disposed = true
    this.revision++
  }
  private publish(update: Partial<PushState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...update }
    this.changed()
  }
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => undefined)
    return result
  }
  setEnabled(enabled: boolean): Promise<void> {
    if (this.disposed || (!enabled && this.state.enabled === enabled))
      return Promise.resolve()
    const revision = ++this.revision
    this.publish({ enabled, pending: true, error: null })
    // Start the browser operation in the tap handler, never from the I/O queue.
    if (enabled && !this.subscription) {
      try {
        this.subscription = this.dependencies.browser.subscribe()
      } catch (error) {
        this.subscription = Promise.reject(error)
      }
      void this.subscription.then(
        () => {
          this.subscription = null
        },
        () => {
          this.subscription = null
        }
      )
    }
    const subscription = this.subscription?.then(
      (value) => ({ value, error: null }),
      (error: unknown) => ({ value: null, error })
    )
    return this.enqueue(async () => {
      let stage: PushStage = "subscribe"
      try {
        const result = enabled ? await subscription : null
        if (this.disposed || revision !== this.revision) return
        if (enabled && !result?.value)
          throw result?.error ?? new Error("Missing subscription")
        if (enabled)
          this.publish({ hasSubscription: true, permission: "granted" })
        stage = "save"
        this.dependencies.record?.("save-start")
        const device = await this.dependencies.save(
          enabled && result?.value
            ? { enabled: true, subscription: result.value }
            : { enabled: false }
        )
        this.dependencies.record?.("save-success")
        this.publish({ device })
        if (revision === this.revision)
          this.publish({ enabled: device.enabled, pending: false })
      } catch (cause) {
        if (this.disposed || revision !== this.revision) return
        this.dependencies.record?.(`${stage}-failed`, cause)
        const error = new PushError(stage, cause)
        this.publish({
          enabled: this.state.device?.enabled ?? false,
          pending: false,
          error,
        })
        throw error
      }
    })
  }
  refresh(): Promise<void> {
    if (this.disposed || this.state.pending) return Promise.resolve()
    const revision = this.revision
    return this.enqueue(async () => {
      if (this.disposed || this.state.pending || revision !== this.revision)
        return
      try {
        const [device, observed] = await Promise.all([
          this.dependencies.read(),
          this.dependencies.browser.read(),
        ])
        if (this.disposed || revision !== this.revision) return
        let confirmed = device
        // Repair an existing transport only; observation must never open a prompt.
        if (
          device.enabled &&
          observed.permission === "granted" &&
          observed.subscription &&
          JSON.stringify(device.subscription) !==
            JSON.stringify(observed.subscription)
        ) {
          confirmed = await this.dependencies.save({
            enabled: true,
            subscription: observed.subscription,
          })
        }
        this.publish({
          device: confirmed,
          permission: observed.permission,
          hasSubscription: observed.subscription !== null,
        })
        if (revision === this.revision)
          this.publish({ enabled: confirmed.enabled, error: null })
      } catch (cause) {
        if (!this.disposed && revision === this.revision) {
          this.dependencies.record?.("refresh-failed", cause)
        }
      }
    })
  }
}

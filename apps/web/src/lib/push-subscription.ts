import {
  base64UrlBytes,
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/api/push"

export async function syncSubscription(enabled: boolean): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.active)
    throw new Error(
      "通知の準備ができていません。アプリを再読み込みして、もう一度お試しください。"
    )
  const current = await registration.pushManager.getSubscription()
  if (!enabled) {
    if (current) {
      await removePushSubscription(current.endpoint)
      await current.unsubscribe()
    }
    return
  }
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("通知が許可されていません。")
  }
  if (current) {
    await savePushSubscription(current.toJSON())
    return
  }
  const { publicKey } = await getPushConfig()
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlBytes(publicKey),
  })
  try {
    await savePushSubscription(subscription.toJSON())
  } catch (error) {
    await subscription.unsubscribe()
    throw error
  }
}

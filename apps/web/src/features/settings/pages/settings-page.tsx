import { AccountSettings } from "@/features/account/components/account-settings"
import { PushControl } from "@/features/notifications/components/push-control"
import { SettingsSection } from "@/components/settings-section"
import { ThemeChoice } from "@/features/settings/components/theme-choice"
import { SettingsRow } from "@/components/settings-section"

/**
 * The member's own settings. Every value here is settled before the page is
 * shown — the account from the route, the device's notifications from the
 * load, the theme from the document — so nothing arrives after the first
 * frame.
 */
export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
      <SettingsSection title="アカウント">
        <AccountSettings />
      </SettingsSection>

      <SettingsSection title="通知">
        <PushControl />
      </SettingsSection>

      <SettingsSection title="外観">
        <SettingsRow label="テーマ" control={<ThemeChoice />} />
      </SettingsSection>
    </div>
  )
}

import type { Context, Env } from "hono"

type Status = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500

export type Failure = { status: Status; code: string; message: string }

const define = (status: Status, code: string, message: string): Failure => ({
  status,
  code,
  message,
})

/** Every failure the API can return. Messages are shown to the member. */
export const errors = {
  // Session and origin
  unauthorized: define(401, "UNAUTHORIZED", "ログインが必要です。"),
  onboardingRequired: define(
    403,
    "ONBOARDING_REQUIRED",
    "利用登録が必要です。"
  ),
  forbiddenOrigin: define(
    403,
    "FORBIDDEN_ORIGIN",
    "リクエスト元が許可されていません。"
  ),
  systemAdminRequired: define(
    403,
    "FORBIDDEN",
    "システム管理者権限が必要です。"
  ),

  // Years
  invalidYear: define(422, "INVALID_YEAR", "年度を確認してください。"),
  yearRequired: define(422, "INVALID_YEAR", "年度を指定してください。"),
  defaultYearRequired: define(
    422,
    "INVALID_YEAR",
    "既定の年度を指定してください。"
  ),
  yearNotFound: define(404, "YEAR_NOT_FOUND", "年度が見つかりません。"),
  yearMembershipRequired: define(
    403,
    "YEAR_MEMBERSHIP_REQUIRED",
    "年度への参加が必要です。"
  ),
  memberNotInYear: define(
    409,
    "YEAR_MEMBERSHIP_REQUIRED",
    "対象が年度に参加していません。"
  ),

  // Permissions
  shiftManagementRequired: define(
    403,
    "FORBIDDEN",
    "シフト管理権限が必要です。"
  ),
  memberManagementRequired: define(
    403,
    "FORBIDDEN",
    "メンバー管理権限が必要です。"
  ),
  roleManagementRequired: define(
    403,
    "FORBIDDEN",
    "ロール管理権限が必要です。"
  ),
  roleGrantAuthorityRequired: define(
    403,
    "FORBIDDEN",
    "ロール管理権限と、付与する権限が必要です。"
  ),

  // Roles
  invalidRole: define(422, "INVALID_ROLE", "ロール設定を確認してください。"),
  invalidRoleOrder: define(
    422,
    "INVALID_ROLE_ORDER",
    "並び順を確認してください。"
  ),
  invalidRoleChanges: define(
    422,
    "INVALID_ROLE_CHANGES",
    "ロールの変更内容を確認してください。"
  ),
  conflictingRoleChanges: define(
    422,
    "INVALID_ROLE_CHANGES",
    "同じメンバーのロール変更が重複しています。"
  ),
  roleNotFound: define(404, "ROLE_NOT_FOUND", "ロールが見つかりません。"),
  roleNameExists: define(
    409,
    "ROLE_NAME_EXISTS",
    "同じ名前のロールがあります。"
  ),
  roleOrderChanged: define(
    409,
    "ROLE_ORDER_CHANGED",
    "ロールが変更されました。読み込み直してください。"
  ),
  roleEditForbidden: define(
    403,
    "ROLE_HIERARCHY",
    "このロールの編集、またはこの権限の付与はできません。"
  ),
  roleGrantForbidden: define(
    403,
    "ROLE_HIERARCHY",
    "このロールは付与できません。"
  ),
  roleOrderForbidden: define(
    403,
    "ROLE_HIERARCHY",
    "自分と同じか上位のロールは並べ替えられません。"
  ),
  memberEditForbidden: define(
    403,
    "ROLE_HIERARCHY",
    "このメンバーは変更できません。"
  ),

  // Availability
  invalidAnswers: define(422, "INVALID_ANSWERS", "回答を確認してください。"),
  invalidAvailabilityDate: define(
    422,
    "INVALID_DATE",
    "日程の設定を確認してください。"
  ),
  availabilityFormChanged: define(
    409,
    "FORM_CHANGED",
    "受付内容が変更されました。入力内容を確認してください。"
  ),
  availabilityFormClosed: define(
    409,
    "FORM_CLOSED",
    "受付中の日程がありません。"
  ),
  invalidNotificationTarget: define(
    422,
    "INVALID_NOTIFICATION",
    "通知対象を指定してください。"
  ),
  notificationRetry: define(
    500,
    "NOTIFICATION_RETRY",
    "一部の通知を送れませんでした。"
  ),

  // Shifts
  invalidActivity: define(
    422,
    "INVALID_ACTIVITY",
    "シフトの内容を確認してください。"
  ),
  invalidActivityTarget: define(
    422,
    "INVALID_TARGET",
    "この年度のメンバー・ロールを選択してください。"
  ),
  activityNotFound: define(
    404,
    "ACTIVITY_NOT_FOUND",
    "シフトが見つかりません。"
  ),
  invalidTimeRange: define(
    422,
    "INVALID_TIME_RANGE",
    "期間はISO 8601形式で指定してください。"
  ),
  timeRangeTooLarge: define(
    422,
    "TIME_RANGE_TOO_LARGE",
    "期間は31日以内で指定してください。"
  ),

  // Chat rooms
  invalidChatRoom: define(
    422,
    "INVALID_CHAT_ROOM",
    "チャットの内容を確認してください。"
  ),
  invalidChatRequest: define(
    422,
    "INVALID_CHAT_QUERY",
    "リクエストを確認してください。"
  ),
  invalidChatTarget: define(
    422,
    "INVALID_CHAT_TARGET",
    "宛先を確認してください。"
  ),
  invalidChatYear: define(
    422,
    "INVALID_CHAT_TARGET_QUERY",
    "年度を確認してください。"
  ),
  chatRoomNotFound: define(
    404,
    "CHAT_ROOM_NOT_FOUND",
    "チャットが見つかりません。"
  ),
  chatRoomCreateFailed: define(
    500,
    "ROOM_CREATE_FAILED",
    "チャットを作成できませんでした。"
  ),
  chatManagementRequired: define(
    403,
    "FORBIDDEN",
    "チャットの管理権限が必要です。"
  ),
  chatExitDisabled: define(
    409,
    "EXIT_DISABLED",
    "このチャットは退出できません。"
  ),
  lastChatManager: define(
    409,
    "LAST_CHAT_MANAGER",
    "ほかの人に管理権限を付けてから退出してください。"
  ),
  invalidChatSettings: define(
    422,
    "INVALID_ROOM_SETTINGS",
    "チャット設定を確認してください。"
  ),
  shiftRoomKept: define(
    409,
    "SHIFT_ROOM_KEPT",
    "シフトのチャットは削除できません。シフトを削除すると一緒に削除されます。"
  ),
  chatSettingsChanged: define(
    409,
    "CHAT_SETTINGS_CHANGED",
    "権限が変更されました。"
  ),
  invalidChatPreferences: define(
    422,
    "INVALID_PREFERENCES",
    "通知設定を確認してください。"
  ),

  // Chat messages
  invalidChatMessage: define(
    422,
    "INVALID_CHAT_MESSAGE",
    "メッセージを確認してください。"
  ),
  invalidMessageContent: define(
    422,
    "INVALID_MESSAGE",
    "本文を確認してください。"
  ),
  emptyMessage: define(422, "EMPTY_MESSAGE", "本文または画像が必要です。"),
  invalidChatAttachments: define(
    422,
    "INVALID_CHAT_ATTACHMENTS",
    "画像または返信先を確認して、もう一度送信してください。"
  ),
  messageNotFound: define(
    404,
    "MESSAGE_NOT_FOUND",
    "メッセージが見つかりません。"
  ),
  messageForbidden: define(
    403,
    "MESSAGE_FORBIDDEN",
    "このメッセージは変更できません。"
  ),
  chatReadOnly: define(
    403,
    "CHAT_READ_ONLY",
    "このチャットには投稿できません。"
  ),
  chatPostingRevoked: define(
    403,
    "CHAT_READ_ONLY",
    "投稿権限が変更されました。"
  ),

  // Chat links and images
  invalidChatLink: define(
    422,
    "INVALID_CHAT_LINK",
    "リンクを確認してください。"
  ),
  imageNotFound: define(404, "NOT_FOUND", "画像が見つかりません。"),
  imageTooLarge: define(413, "IMAGE_SIZE", "画像は1枚20MBまでです。"),
  imageLimit: define(
    429,
    "IMAGE_LIMIT",
    "画像のアップロード上限に達しました。時間をおいてお試しください。"
  ),
  invalidImage: define(
    422,
    "INVALID_IMAGE",
    "対応する写真・画像を選択してください（最大5000万画素）。"
  ),
  imageExpired: define(
    409,
    "IMAGE_EXPIRED",
    "画像をもう一度添付してください。"
  ),
  imageProcessingFailed: define(
    422,
    "IMAGE_PROCESSING_FAILED",
    "画像を処理できませんでした。別の画像でお試しください。"
  ),

  // Devices and notifications
  invalidDevice: define(422, "INVALID_DEVICE", "端末を確認してください。"),
  deviceNotFound: define(404, "NOT_FOUND", "端末が見つかりません。"),
  invalidNotificationSettings: define(
    422,
    "INVALID_NOTIFICATION_SETTINGS",
    "通知設定を確認してください。"
  ),
  invalidPushSubscription: define(
    422,
    "INVALID_PUSH_SUBSCRIPTION",
    "通知の購読情報を確認してください。"
  ),
  subscriptionConflict: define(
    409,
    "SUBSCRIPTION_CONFLICT",
    "通知の購読情報が利用できません。"
  ),

  // Shift responsibility and attendance
  shiftCreationRequired: define(
    403,
    "FORBIDDEN",
    "シフトの作成権限が必要です。"
  ),
  shiftResponsibilityRequired: define(
    403,
    "FORBIDDEN",
    "責任者の権限が必要です。"
  ),
  changeForbidden: define(403, "FORBIDDEN", "変更する権限がありません。"),
  viewForbidden: define(403, "FORBIDDEN", "閲覧する権限がありません。"),
  attendanceViewForbidden: define(
    403,
    "FORBIDDEN",
    "本人または責任者のみ確認できます。"
  ),
  membershipEditForbidden: define(
    403,
    "ROLE_HIERARCHY",
    "このメンバーの参加を変更する権限がありません。"
  ),
  invalidAttendance: define(
    422,
    "INVALID_ATTENDANCE",
    "出勤情報を確認してください。"
  ),
  attendanceReasonRequired: define(
    422,
    "INVALID_ATTENDANCE",
    "出勤時刻と理由を入力してください。"
  ),
  attendanceChanged: define(
    409,
    "ATTENDANCE_CONFLICT",
    "出勤記録が変更されました。"
  ),
  attendanceFinal: define(
    409,
    "ATTENDANCE_CONFLICT",
    "出勤済みのシフトは変更できません。"
  ),
  attendanceNotFound: define(
    404,
    "ATTENDANCE_NOT_FOUND",
    "遅刻・欠勤の記録がありません。"
  ),

  // Shift plans
  invalidShift: define(
    422,
    "INVALID_SHIFT",
    "シフトの内容を確認してください。"
  ),
  invalidResponsible: define(
    422,
    "INVALID_RESPONSIBLE",
    "責任者はこの年度のメンバーから選んでください。"
  ),
  invalidYearRole: define(
    422,
    "INVALID_ROLE",
    "この年度のロールを選択してください。"
  ),
  duplicateTarget: define(
    422,
    "DUPLICATE_TARGET",
    "同じ対象は一度だけ指定してください。"
  ),
  dateRequired: define(422, "INVALID_DATE", "日付を指定してください。"),
  responsibleRequired: define(
    409,
    "RESPONSIBLE_REQUIRED",
    "有効にするには責任者が必要です。"
  ),
  slotFromOtherShift: define(409, "INVALID_SLOT", "別のシフトの枠です。"),
  shiftConflict: define(
    409,
    "SHIFT_CHANGED",
    "他の変更と競合しました。編集内容を保持したまま確認してください。"
  ),
  shiftStale: define(
    409,
    "SHIFT_CHANGED",
    "別の操作で更新されています。編集内容を確認して読み直してください。"
  ),
  shiftInactive: define(409, "SHIFT_INACTIVE", "有効なシフトで通知できます。"),
  assignmentNotFound: define(
    404,
    "ASSIGNMENT_NOT_FOUND",
    "シフトが見つかりません。"
  ),

  // Memberships
  yearExists: define(409, "YEAR_EXISTS", "この年度はすでにあります。"),
  yearMemberNotFound: define(
    404,
    "RESOURCE_NOT_FOUND",
    "年度またはメンバーが見つかりません。"
  ),
  yearMembershipNotFound: define(
    404,
    "YEAR_MEMBERSHIP_NOT_FOUND",
    "年度への参加が見つかりません。"
  ),
  futureShiftsAssigned: define(
    409,
    "FUTURE_SHIFTS",
    "今後のシフトからメンバーを外してから参加を解除してください。"
  ),

  // Chat managers
  chatManagerRequired: define(
    409,
    "LAST_CHAT_MANAGER",
    "管理権限を持つメンバーを残してください。"
  ),
  chatSettingsReload: define(
    409,
    "CHAT_SETTINGS_CHANGED",
    "権限が変更されました。設定を読み直してください。"
  ),

  // Fallbacks
  routeNotFound: define(404, "NOT_FOUND", "APIが見つかりません。"),
  internalError: define(
    500,
    "INTERNAL_ERROR",
    "サーバーでエラーが発生しました。"
  ),
  roleConflict: define(
    409,
    "ROLE_CONFLICT",
    "年度が見つからないか、同じ名前のロールがあります。"
  ),

  // Accounts and administration
  bodyTooLarge: define(413, "BODY_TOO_LARGE", "リクエストが大きすぎます。"),
  invalidJson: define(400, "INVALID_JSON", "リクエスト形式が不正です。"),
  invalidOnboardingData: define(
    400,
    "INVALID_ONBOARDING_DATA",
    "登録内容を確認してください。"
  ),
  accountExists: define(409, "ACCOUNT_EXISTS", "アカウントはすでにあります。"),
  accountConflict: define(
    409,
    "ACCOUNT_CONFLICT",
    "アカウントを作成できませんでした。"
  ),
  memberNotFound: define(404, "MEMBER_NOT_FOUND", "メンバーが見つかりません。"),
  invalidRoleChange: define(
    400,
    "INVALID_ROLE_CHANGE",
    "権限の変更内容を確認してください。"
  ),
  selfRoleChange: define(
    409,
    "SELF_ROLE_CHANGE",
    "自分の権限は変更できません。"
  ),
  roleUnchanged: define(409, "ROLE_UNCHANGED", "権限は変更されていません。"),
  lastSystemAdmin: define(
    409,
    "LAST_SYSTEM_ADMIN",
    "システム管理者を1人以上残してください。"
  ),
  invalidSessionRevocation: define(
    400,
    "INVALID_SESSION_REVOCATION",
    "セッションの取り消し内容を確認してください。"
  ),
  invalidIdentityLinkDecision: define(
    400,
    "INVALID_IDENTITY_LINK_DECISION",
    "申請の処理内容を確認してください。"
  ),
  linkRequestNotFound: define(
    404,
    "LINK_REQUEST_NOT_FOUND",
    "申請が見つかりません。"
  ),
  linkRequestNotPending: define(
    409,
    "LINK_REQUEST_NOT_PENDING",
    "申請はすでに処理されています。"
  ),
  selfIdentityRecovery: define(
    409,
    "SELF_IDENTITY_RECOVERY",
    "自分のアカウントの復旧は承認できません。"
  ),
  identityRecoveryConflict: define(
    409,
    "IDENTITY_RECOVERY_CONFLICT",
    "復旧の条件が変わりました。"
  ),
} as const

/** Why a shift plan cannot be saved, keyed by the domain rule that rejected it. */
export const shiftPlanErrors = {
  INVALID_TIME_RANGE: define(
    409,
    "INVALID_TIME_RANGE",
    "終了時刻は開始時刻より後にしてください。"
  ),
  DUPLICATE_SLOT: define(409, "DUPLICATE_SLOT", "同じ時間枠が重複しています。"),
  SLOT_OUTSIDE_SHIFT: define(
    409,
    "SLOT_OUTSIDE_SHIFT",
    "時間枠はシフトの時間内にしてください。"
  ),
  DUPLICATE_MEMBER: define(
    409,
    "DUPLICATE_MEMBER",
    "同じメンバーが重複しています。"
  ),
  YEAR_MEMBERSHIP_REQUIRED: define(
    409,
    "YEAR_MEMBERSHIP_REQUIRED",
    "この年度に参加していないメンバーがいます。"
  ),
  SHIFT_OVERLAP: define(
    409,
    "SHIFT_OVERLAP",
    "勤務時間が重なるメンバーがいます。"
  ),
} as const

export function errorBody({ code, message }: Failure) {
  return { error: { code, message } }
}

/** Replace `message` only when the reason is narrower than the catalog entry. */
export function apiError<E extends Env>(
  c: Context<E>,
  failure: Failure,
  message = failure.message
) {
  return c.json({ error: { code: failure.code, message } }, failure.status)
}

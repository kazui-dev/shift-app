# Database

この文書は保存先の境界と、変更時に守る制約を記す。列・外部キー・index の正は [Drizzle schema](../packages/db/src/schema.ts)、Better Auth の表は [auth-schema.ts](../packages/db/src/auth-schema.ts)、D1 に適用する定義の正は [SQL migration](../apps/api/migrations) とする。実際の振る舞いは [runtime-behavior.md](design/runtime-behavior.md)、旧クライアント向けの扱いは [compatibility.md](compatibility.md) を参照する。

## 保存先と変更方法

- アプリの関係データは Cloudflare D1 に保存し、Drizzle で扱う。時刻は Unix epoch milliseconds を使う。
- Chat のメッセージ本文はルームごとの `ChatRoom` Durable Object の SQLite に保存する。D1 はルーム、対象者、未読用 index などの管理情報を持つ。D1 と Durable Object にまたがる transaction はない。
- Chat の画像は R2 に保存する。画像の参照権限は対応するメッセージの権限で確認する。
- 適用済み migration は編集しない。schema の変更には新しい migration を生成し、既存データ・制約・削除動作を確認する。schema をファイル別に分けたこと自体は DB migration を必要としない。
- `packages/db/src/schema.ts` は各領域の schema を公開する入口。表の定義は `packages/db/src/schema/` に置き、アプリ間の入出力契約は `packages/shared/src/contracts/` に置く。DB の行型を HTTP 契約として直接使わない。

## アカウントと組織

[account.ts](../packages/db/src/schema/account.ts) の `app_users` はアプリの利用者を表し、Better Auth の `user` は認証主体を表す。認証だけ済んだ利用者とアプリの利用者を区別する。学籍番号はアプリ利用者で一意とし、入力境界で正規化する。所属確認、identity 復旧申請、管理操作の監査記録もこの領域に置く。OAuth の identity は Better Auth の `account` に置き、所属確認に token を複製しない。identity の移動を申請だけで確定させない。

[organization.ts](../packages/db/src/schema/organization.ts) には年度、参加状態、年度 role と権限、局・担当、年度別名簿を置く。名簿 `student_directory` はアカウントとは独立しており、同一人物が複数年度の名簿に載れる。局・担当は名前ではなく `role_id` で年度 role を参照する。年度参加 `year_memberships` と role 付与 `member_year_roles` は別の関係であり、role だけで年度参加にはならない。参加を `inactive` にしても過去の割当や role は削除せず、通常アクセスと実効権限から除外する。

年度は `operating_years` で管理する。`year_settings` のデフォルト年度は 1 件だけで、年度へのアクセス権を付与しない。初期化と削除禁止の trigger は migration で管理する。年度 role の権限は `shift.create`、`shift.manage`、`member.manage`、`role.manage`。実効権限は API で確認する。

## 活動・希望・割当・勤怠

[activities.ts](../packages/db/src/schema/activities.ts) は年度内の活動と責任者、履歴、候補 role、通知設定を持つ。[availability.ts](../packages/db/src/schema/availability.ts) は希望の提出、入力可能日、時間帯、下書きと日別回答を持つ。[shifts.ts](../packages/db/src/schema/shifts.ts) は活動内の `shift_slots`、利用者への `shift_assignments`、勤怠の現在値と変更履歴を持つ。割当の時間と定員は slot に置き、割当行には重複して持たない。取消済み割当は監査のため保持する。

名簿上の人をアカウント作成前に扱う `directory_availability_*` と `directory_shift_assignments` もある。アカウントの希望・割当とは別の保存先なので、統合時の扱いは [compatibility.md](compatibility.md) と実装で確認する。

希望の時間関係、slot と割当の重複、勤怠の遷移は DB 制約だけでは完結しない。共有契約による入力検証と API の認可・業務ロジックも合わせて変更する。

## Chat

[chat.ts](../packages/db/src/schema/chat.ts) はルーム、活動との関連、対象者、bot、利用者設定、メッセージ index、削除・退出記録を持つ。対象者は現在の参加・role・割当と照合するため、過去に対象だったことだけで閲覧権は残らない。bot は投稿者であり、利用者と同じ閲覧主体にはしない。

メッセージの正は [chat-room.ts](../apps/api/src/features/chat/durable-objects/chat-room.ts) の `ChatRoom` Durable Object。非公開メッセージの閲覧判定は [private-messages.ts](../apps/api/src/features/chat/services/private-messages.ts) に集約する。履歴、リアルタイム配信、未読、画像などがこの判定を通るようにする。Worker は D1 側でアクセスを確認してから Durable Object を呼ぶ。

## Push

[notifications.ts](../packages/db/src/schema/notifications.ts) の `notification_devices` は端末ごとの配信設定と購読情報を持つ。OFF はサーバー側の配信停止であり、購読解除とは別。endpoint は capability URL として扱い、ログに出さない。`notification_deliveries` は割当・端末・通知種別ごとの送信 claim を持ち、重複配送を抑える。失敗時の再試行とプロセス停止時の限界は [runtime-behavior.md](design/runtime-behavior.md) を参照する。

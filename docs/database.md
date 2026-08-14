# Database

この文書は実装済みの認証・シフト schema と、今後の chat・push schema の目標を示す。実装の正は `packages/db/src/schema.ts` と SQL migration とする。

## Policy

- DB は Cloudflare D1 を使う
- ORM は Drizzle を使う
- 時刻は Unix epoch milliseconds で保存する
- 年度をまたいで使うため、年度に依存するデータには `year` を持たせる
- Better Auth が必要とする `user`、`session`、`account` などの core schema は Better Auth に合わせる
- Better Auth `user` は認証主体、`members` は onboarding 済みのシフトアプリアカウントとして分離する
- `members.student_id` と `members.user_id` はそれぞれ unique とし、アカウントと学籍番号を 1:1 にする
- OAuth identity は Better Auth `account` として保持する。初期版は Discord 1 件、将来は 1 人の `user` に複数 provider を連携できる
- application ID は `crypto.randomUUID()` で生成する

認証関連 table は `packages/db/src/auth-schema.ts` と `packages/db/src/schema.ts` を正とする。既存の placeholder `members` table を作り直す `0001` migration は、対象 DB の `members` が 0 件であることを確認してから適用する。

## User Management

### `members`

| Column         | Type    | Note                                         |
| -------------- | ------- | -------------------------------------------- |
| `id`           | text    | PK                                           |
| `user_id`      | text    | unique FK, Better Auth `user.id`             |
| `display_name` | text    | 本名                                         |
| `student_id`   | text    | unique、`COLLATE NOCASE`、正規化済み学籍番号 |
| `access_level` | text    | `system_admin`, `leader`, `member`           |
| `created_at`   | integer | UNIX time milliseconds                       |
| `updated_at`   | integer | UNIX time milliseconds                       |

Better Auth `user` が存在しても `members` がなければ onboarding 中とする。通常 API は `members` の存在を必須とし、作成直後の `access_level` は `member` とする。

`student_id` は `^\d{2}[A-Z]{2}\d{3}$` を満たす canonical value だけを保存する。API で Unicode NFKC 正規化、trim、大文字化を行い、DB の case-insensitive unique index でも重複を防ぐ。入学年度と学科コードは必要になった時点で `student_id` から導出し、同じ情報を別 column に重複保存しない。

### Better Auth `account`

初期版は 1 つの Better Auth `user` に Discord identity を 1 件連携する。`(provider_id, account_id)` を unique とし、同じ provider identity が複数 user へ紐づかないようにする。schema は将来の複数 provider に対応できる。OAuth token は Better Auth の token encryption を有効にして保存する。

暗黙の email linking は使わない。provider 追加は将来拡張とする。

### `affiliation_verifications`

| Column                | Type    | Note                          |
| --------------------- | ------- | ----------------------------- |
| `id`                  | text    | PK                            |
| `user_id`             | text    | FK, Better Auth `user.id`     |
| `provider_id`         | text    | 初期版は `discord`            |
| `provider_account_id` | text    | provider 内の stable identity |
| `organization_id`     | text    | Discord server ID             |
| `verified_at`         | integer | 最終所属確認時刻              |
| `created_at`          | integer | UNIX time milliseconds        |
| `updated_at`          | integer | UNIX time milliseconds        |

`(provider_id, provider_account_id)` を unique とする。access/refresh token 自体はこの table に重複保存しない。

### `identity_link_requests`

学籍番号が既存だった場合の管理者復旧に使う。申請だけで identity を移動せず、承認処理は監査ログ、旧Discord identityの解除、新しい検証済みidentityの移動、申請者と対象memberの全session失効を1つのD1 batchで行う。対象member本人による自己承認は禁止する。

| Column              | Type    | Note                                           |
| ------------------- | ------- | ---------------------------------------------- |
| `id`                | text    | PK                                             |
| `requester_user_id` | text    | FK, onboarding 中の Better Auth `user.id`      |
| `target_member_id`  | text    | FK, `members.id`                               |
| `status`            | text    | `pending`, `approved`, `rejected`, `cancelled` |
| `decided_by`        | text    | FK, `members.id`, nullable                     |
| `created_at`        | integer | UNIX time milliseconds                         |
| `decided_at`        | integer | UNIX time milliseconds, nullable               |

### `admin_audit_logs`

`system_admin` の昇格、identity recovery、role 変更、全session失効などの管理操作を理由付きで記録する。初回管理者昇格も公開 bootstrap API を使わず、Cloudflare operator が既存 member を特定して D1 上で実行し、この table に同じ操作 ID の監査記録を残す。通常の管理操作は更新と監査recordをD1 batchにまとめ、どちらか一方だけが成立しないようにする。

### `operating_years`

年度の名称、対象期間、編集状態（`draft`, `active`, `archived`）を保持する。年度依存 table の親となり、archived 年度への activity・希望・割当の変更は API で拒否する。

### `year_roles`

| Column       | Type    | Note                       |
| ------------ | ------- | -------------------------- |
| `id`         | text    | PK                         |
| `year`       | integer | FK, `operating_years.year` |
| `name`       | text    | ロール名                   |
| `color`      | text    | 表示色                     |
| `created_at` | integer | UNIX time milliseconds     |
| `updated_at` | integer | UNIX time milliseconds     |

### `year_role_permissions`

年度別 role に機能権限を付与する。初期版の permission は `shift.manage`。application role の `leader` だけを根拠にシフト管理を許可せず、`system_admin` の全体権限またはこの permission を API で確認する。

### `member_year_roles`

| Column       | Type    | Note                    |
| ------------ | ------- | ----------------------- |
| `member_id`  | text    | PK, FK, `members.id`    |
| `role_id`    | text    | PK, FK, `year_roles.id` |
| `created_at` | integer | UNIX time milliseconds  |

## Shift Management

### `activities`

| Column          | Type    | Note                   |
| --------------- | ------- | ---------------------- |
| `id`            | text    | PK                     |
| `year`          | integer | 年度                   |
| `name`          | text    | 活動名                 |
| `place`         | text    | 場所                   |
| `activity_type` | text    | 種別                   |
| `starts_at`     | integer | UNIX time milliseconds |
| `ends_at`       | integer | UNIX time milliseconds |
| `color`         | text    | 表示色                 |
| `notes`         | text    | nullable               |
| `created_by`    | text    | FK, `members.id`       |
| `updated_by`    | text    | FK, `members.id`       |
| `created_at`    | integer | UNIX time milliseconds |
| `updated_at`    | integer | UNIX time milliseconds |

### `availability_submissions`

年度・member ごとの希望提出を一件保持し、`draft` または `submitted` とする。希望の具体的な時間帯は子 table に分離する。

### `availability_windows`

希望時間帯を任意の開始・終了時刻で保持する。固定の時間粒度は DB に埋め込まない。同一提出内の重複は共有 schema と API で拒否し、各行は DB の check constraint でも `starts_at < ends_at` を保証する。

### `shift_assignments`

| Column         | Type    | Note                   |
| -------------- | ------- | ---------------------- |
| `id`           | text    | PK                     |
| `activity_id`  | text    | FK, `activities.id`    |
| `member_id`    | text    | FK, `members.id`       |
| `starts_at`    | integer | UNIX time milliseconds |
| `ends_at`      | integer | UNIX time milliseconds |
| `notes`        | text    | nullable               |
| `status`       | text    | `active`, `cancelled`  |
| `created_by`   | text    | FK, `members.id`       |
| `cancelled_by` | text    | FK, nullable           |
| `cancelled_at` | integer | nullable               |
| `created_at`   | integer | UNIX time milliseconds |
| `updated_at`   | integer | UNIX time milliseconds |

割当は activity 内の時間に限定し、member の active な割当同士の重複を API の条件付き insert で防ぐ。取消は監査情報を残すため物理削除せず `cancelled` に更新する。希望時間外の割当は業務上必要になり得るため拒否せず、API が警告を返す。

勤怠 table は未実装。出勤・退勤・修正履歴の要件を確定してから追加する。

## Chat Management

### `chat_rooms`

| Column        | Type    | Note                   |
| ------------- | ------- | ---------------------- |
| `id`          | text    | PK                     |
| `year`        | integer | 年度                   |
| `name`        | text    | ルーム名               |
| `is_disabled` | integer | boolean                |
| `created_at`  | integer | UNIX time milliseconds |
| `updated_at`  | integer | UNIX time milliseconds |

### `chat_room_permissions`

| Column             | Type    | Note                               |
| ------------------ | ------- | ---------------------------------- |
| `id`               | text    | PK                                 |
| `room_id`          | text    | FK, `chat_rooms.id`                |
| `member_id`        | text    | FK, `members.id`, nullable         |
| `role_id`          | text    | FK, `roles.id`, nullable           |
| `activity_id`      | text    | FK, `activities.id`, nullable      |
| `permission_level` | text    | `read_only`, `read_write`, `admin` |
| `created_at`       | integer | UNIX time milliseconds             |
| `updated_at`       | integer | UNIX time milliseconds             |

### `chat_messages`

| Column       | Type    | Note                   |
| ------------ | ------- | ---------------------- |
| `id`         | text    | PK                     |
| `room_id`    | text    | FK, `chat_rooms.id`    |
| `sender_id`  | text    | FK, `members.id`       |
| `content`    | text    | 本文                   |
| `created_at` | integer | UNIX time milliseconds |

## Push Notifications

### `push_subscriptions`

| Column       | Type    | Note                      |
| ------------ | ------- | ------------------------- |
| `id`         | text    | PK                        |
| `user_id`    | text    | FK, Better Auth `user.id` |
| `endpoint`   | text    | Push service URL          |
| `p256dh`     | text    | 公開鍵                    |
| `auth`       | text    | 認証シークレット          |
| `created_at` | integer | UNIX time milliseconds    |
| `updated_at` | integer | UNIX time milliseconds    |

## ER Diagram

```mermaid
erDiagram
    auth_users ||--o| members : activates
    auth_users ||--o{ auth_accounts : links
    auth_users ||--o{ affiliation_verifications : verifies
    auth_users ||--o{ identity_link_requests : requests
    members ||--o{ identity_link_requests : target
    operating_years ||--o{ year_roles : defines
    operating_years ||--o{ activities : contains
    operating_years ||--o{ availability_submissions : collects
    year_roles ||--o{ year_role_permissions : grants
    year_roles ||--o{ member_year_roles : assigned_to
    members ||--o{ member_year_roles : has
    members ||--o{ availability_submissions : submits
    availability_submissions ||--o{ availability_windows : contains
    activities ||--o{ shift_assignments : has
    members ||--o{ shift_assignments : assigned_to
    chat_rooms ||--o{ chat_room_permissions : controlled_by
    chat_rooms ||--o{ chat_messages : contains
    members ||--o{ chat_room_permissions : participates
    year_roles ||--o{ chat_room_permissions : granted_by
    activities ||--o{ chat_room_permissions : linked_to
    members ||--o{ chat_messages : sends
```

## Open Questions

- 場所の master table を作るか
- 既読管理をどの粒度で持つか
- application role と機能別 role の permission matrix
- ロールが外れた後のチャット閲覧権限をどう扱うか

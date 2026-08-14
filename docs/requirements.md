# Requirements

## Overview

旭祭実行委員会メンバーが利用するシフト管理アプリを作る。

主な目的:

- 年度をまたいで利用できるシフト管理
- シフト提出と割り当て
- 勤怠管理
- 管理者からの事務連絡
- 遅刻・欠勤連絡
- チャット
- PWA の installability、asset cache、プッシュ通知、オフライン対応
- TanStack Query を使った optimistic update

## Users

- 委員会メンバー
- シフト管理者
- システム管理者

管理者向け画面は PC 利用を想定する。メンバー向け画面はモバイルファーストにする。

## UI

- 未ログイン時の初期画面は「Discord で続ける」だけにする
- 認証と onboarding の完了後に表示するホーム画面はタイムラインにする
- 1日に複数のタスク、ブース、イベントに入る前提で縦型タイムラインを使う
- 旭祭期間中に素早く確認できる画面を優先する
- モバイルではボトムナビゲーションを使う
- Apple カレンダーのような、日付移動とタイムラインが近い UI を参考にする

## Timeline

タイムラインに表示するもの:

- シフト名
- 場所
- 開始時刻
- 終了時刻
- 詳細
- 同じシフトに入るメンバー
- 連絡事項

検討事項:

- シフト開始前の通知
- 10分前通知
- ファイル添付

## Authentication

### Authentication Sources

メール OTP のホワイトリスト方式は採用しない。初期リリースのログイン画面には次だけを表示する。

- Discord で続ける

理由:

- 毎年 DB 更新が必要になる
- メール配信コストが高い
- 運用負荷が高い

OAuth provider は外部 identity の本人確認と所属確認に使う。学籍番号、表示名、application role など、シフトアプリのアカウント情報は D1 で管理し、OAuth profile をそのままアプリのアカウントにはしない。

許可する所属先:

| Provider | Condition                                            |
| -------- | ---------------------------------------------------- |
| Discord  | server ID `1047724512873041941` の member であること |

server ID は機密情報ではないため非 secret 設定として管理し、client secret、session secret、OAuth token は secret として扱う。

Notion OAuth は初期リリースに含めない。将来追加する場合は、対象 workspace への public OAuth connection の authorization を所属確認として扱う案を再検討する。Notion workspace ID `27865ff8-ac56-47e9-9aac-0ed6f3c4d0c5` は候補として docs に保持するが、credential、binding、UI、provider 実装は現時点で持たない。

### Sign-in And Onboarding

OAuth 後の処理:

1. callback をサーバー側で処理し、Discord identity と対象 server への所属を検証する。
2. provider identity が有効なシフトアプリアカウントに連携済みなら、追加入力なしでログインを完了する。
3. 連携済みアカウントがなければ、学籍番号と表示名を入力する onboarding を表示する。
4. 学籍番号が未登録なら、アカウントを作成し、OAuth identity を連携する。初期 application role は `member` とする。
5. 学籍番号が登録済みなら、新しいアカウントを作成せず、既存データや表示名も上書きしない。既存の Discord account でログインするか、管理者へ連携申請するよう案内する。

OAuth callback と onboarding の間は制限付き session とし、onboarding、logout、連携申請以外の API を利用させない。学籍番号の一意性は UI の事前確認ではなく DB の unique constraint で保証し、同時登録時の競合も安全に失敗させる。

学籍番号は `00NN000` 形式の 7 文字とする。先頭 2 桁が入学年度、続く英字 2 文字が学科、末尾 3 桁が番号で、`26AJ112` などが該当する。validation は `^\d{2}[A-Za-z]{2}\d{3}$` とし、保存前に次の順で正規化する。

1. Unicode NFKC 正規化
2. 前後の空白を除去
3. 学科コードの英字を大文字化

したがって `26aj112` と `26AJ112` は同じ学籍番号として扱う。正規化と形式検証は frontend と API の両方で行い、DB でも大文字小文字を区別しない unique constraint を設ける。学籍番号は個人情報として扱い、URL、通常の application log、analytics event に含めない。

### Account Linking And Recovery

初期リリースは 1 つのシフトアプリアカウントに Discord identity を 1 つ連携する。アカウントと学籍番号は 1:1 とする。将来 Notion などを追加するときはアカウントと OAuth identity を 1:N に拡張できる Better Auth の schema を維持する。

- provider 追加 UI は初期リリースでは実装しない。
- すでに別アカウントへ連携された OAuth identity は移動しない。
- 学籍番号の一致だけを根拠に OAuth identity を自動連携しない。他人の学籍番号を入力した account takeover を防ぐため、`system_admin` の承認を必須とする。
- 連携申請中も対象アカウントのデータを申請者へ開示しない。申請・承認・拒否・session 失効は監査可能にする。

初期リリースでは学籍番号と password によるログインを実装しない。Discord account を失った場合は管理者による本人確認と identity recovery を使う。password login は、reset 方法、rate limit、credential storage の運用を含めて必要性が生じた時点で再検討する。

### Authorization And Sessions

application role は次の 3 種類とする。

| Role           | Responsibility                      |
| -------------- | ----------------------------------- |
| `system_admin` | アカウント復旧、role 変更、全体設定 |
| `leader`       | 委員会幹部向けの管理操作            |
| `member`       | 一般メンバー向け操作                |

シフト、担当、チャットなど機能別の権限は application role だけに詰め込まず、年度別 role や対象 resource の permission で管理する。`system_admin` と `leader` は self-service で取得できない。API は frontend の表示状態を信用せず、session、onboarding 完了、application role、resource permission をサーバー側で検証する。

初回 `system_admin` は「最初に登録した利用者」へ自動付与しない。公開 bootstrap endpoint、学籍番号 allowlist、共有 bootstrap secret も設けない。OAuth と onboarding を完了した既存 member を Cloudflare operator が明示的に選び、D1 上の role 更新と `admin_audit_logs` への記録を一組で実行する。2 人目以降は認証済み `system_admin` の管理画面から昇格し、本人による自己昇格は禁止する。

所属確認は新しい OAuth login 時に必ず行う。初期実装では最後の所属確認から最大 7 日で再 OAuth を要求し、Better Auth session の延長だけでこの期限を延ばさない。`system_admin` はアカウントの全 session を失効できるようにする。

## Offline

オフライン対応で扱うもの:

- Service Worker による app shell と静的 asset の cache
- TanStack Query cache の IndexedDB への永続化と期限管理
- オフライン時のメッセージ送信待ち
- オフライン時のステータス更新待ち

送信待ちは optimistic update だけでは実現できない。再読み込み後に mutation を復元・再開できること、同一操作の重複送信を API 側で無害化できること、競合時に利用者へ結果を示せることを要件とする。

## Shift And Attendance

シフト提出フロー:

1. 希望日時を集める
2. 希望日時に応じて仕事を割り振る
3. 割り当て後に通知する
4. 変更があれば再通知する

勤怠:

- タイムライン上に出勤ボタンを置く
- 勤務時間内だけ押せるようにする

検討事項:

- 希望日時の粒度
- 希望日時外の割り当て
- 遅刻・欠勤時の補充
- 空きメンバーの把握

## Chat

チャットルーム作成時にターゲットを指定する。

ターゲット:

- 単一メンバー
- 複数メンバー
- ロール
- activity

発言権限:

- 未設定なら全員が発言可能
- 必要に応じて read only / read write / admin を設定する

想定パターン:

- DM
- グループチャット
- 担当内連絡
- 業務連絡
- 全体連絡

検討事項:

- ルーム作成権限
- 新しくロールが付いたユーザーが過去ログを見られるか
- ロールが外れたユーザーが過去ログを見られるか
- ルームの無効化

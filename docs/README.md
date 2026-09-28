# ドキュメント案内

| 文書                                                     | 所有する内容                               |
| -------------------------------------------------------- | ------------------------------------------ |
| [AGENTS.md](../AGENTS.md)                                | エージェントへの作業指示と承認境界         |
| [CONTRIBUTING.md](../CONTRIBUTING.md)                    | 作業手順、検証、ブランチと merge           |
| [architecture.md](architecture.md)                       | 現行の構成、所有者、依存方向、実行時の境界 |
| [conventions.md](conventions.md)                         | 配置と実装上の判断規則                     |
| [setup.md](setup.md)                                     | 開発環境、秘密情報、Cloudflare の初期設定  |
| [requirements.md](requirements.md)                       | プロダクト要件                             |
| [database.md](database.md)                               | 実装済み DB と保存データ                   |
| [compatibility.md](compatibility.md)                     | 本番への変更区分と一時的な互換             |
| [design/management.md](design/management.md)             | 管理・シフト業務の目標仕様                 |
| [design/runtime-behavior.md](design/runtime-behavior.md) | 実装済み画面・同期の動作                   |
| [design/chat-images.md](design/chat-images.md)           | チャット画像の保存・配信設計               |
| [adr/](adr/README.md)                                    | 重要な設計判断の背景と影響                 |

現行動作を説明する文書は実装と同じ変更で更新し、目標仕様は実装済みの動作と区別して記す。規則や仕様を複数の文書に複製せず、他の文書からリンクする。ADR は決定の理由を残し、手順や実装の現状を重複管理しない。過去の版は Git で確認する。

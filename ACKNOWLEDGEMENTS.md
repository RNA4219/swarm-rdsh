# 謝辞

swarm-rdshは、以下のOSSを作成・維持する開発者とコミュニティの成果を利用しています。公開された実行基盤、CLI、状態管理、統合処理、開発ツールに感謝します。

| OSS | 本構成で使用するもの |
|---|---|
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | DSHのagent loop、tools、Session、Cordis plugin、model provider |
| [rustdsh](https://github.com/jimoto-no-llm/rustdsh) | DSHへの起動委譲とRustの高速ユーティリティ |
| [Gas Town](https://github.com/gastownhall/gastown) | CLI、Scheduler、Polecat、Hooks/Mail/Molecules、Witness/Deacon、Refinery |
| [Beads](https://github.com/steveyegge/beads) | タスク状態と依存関係、CLI、Doltとの接続 |
| [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) | DSHのターミナルUI、公開注入プロトコル |
| [dsh-std](https://github.com/T-Auto/dsh-std) | 固定TUIのvendor依存。参照元とSHAは依存台帳を参照 |
| [Dolt](https://github.com/dolthub/dolt) | Beads/Gas Townの永続データ基盤 |
| [Git](https://git-scm.com/)、[tmux](https://github.com/tmux/tmux)、[bubblewrap](https://github.com/containers/bubblewrap) | Worktree、ターミナル実行、公開fixtureの隔離 |
| [Node.js](https://nodejs.org/)、[pnpm](https://pnpm.io/)、[TypeScript](https://github.com/microsoft/TypeScript)、[ESLint](https://github.com/eslint/eslint) | アダプターの実行、ビルド、検証 |
| [Go](https://go.dev/)、[Rust](https://www.rust-lang.org/) | 固定Gas Town・Beads・rustdshのビルド |

OpenSandbox、LiteLLM、Langfuseは周辺機能の採用候補です。接続と検証を終えた段階で採用範囲・固定参照・ライセンスを追加します。今回の実行確認に使っていない機能を動作保証として記載しません。

DeepInfraは今回のモデルAPIサービスです。GLMとDeepSeekのモデルを選択する設定を使用しています。APIサービスとモデルを、このプロジェクトが再配布するOSSコードには含めません。

著作権・ライセンスの正本は各上流のLICENSE/NOTICEです。[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)と[依存元台帳](third_party/upstream-sources.json)に固定参照を記載しています。謝辞は上流による本プロジェクトの推奨・公認を意味しません。

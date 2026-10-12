# swarm-rdsh

Gas Town / Beadsが仕事・投入・復旧・統合を管理し、各ワーカーの推論とツール実行をDeepSeek Harnessへ委譲します。rustdshの既存起動方式を維持します。

DeepFlow Swarm v2.1設計に基づく新規リポジトリです。DeerFlow / OpenCode構成の[deepflow-swarm](https://github.com/RNA4219/deepflow-swarm)はアーカイブとして保存し、本構成は独立したGit履歴で管理します。

固定Gas Town・DSH・rustdsh・TUIをWSLでビルドし、公開fixtureの1ジョブを実モデルで実行しました。コード修正、3件のassertion、commit、gt done、Beadsのclosed、Refineryキュー登録に続き、既存Refineryによる統合・統合後テスト・MQ cleanupまで確認しています。途中でGas Townの標準コマンドによる手動復旧を行いました。通常運用の資格、通常nudge、自動復旧、保護PRでのRefinery統合、並列実行は未合格です。[実E2E記録](docs/REAL_E2E.md)に結果と制約を記載しています。

## ローカルで実行できるもの

Node 24.15.0とpnpm 10.20.0を使用します。

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run test:contract
pnpm run test:lifecycle
pnpm run test:integration
pnpm run check:design
pnpm run doctor
```

doctorはコマンドの到達性を調べます。必要なツールが不足する場合は終了コード2です。モデル、Gas Town、DSH、DBを起動しません。

WindowsからWSL Ubuntu専用のNodeを準備する場合はtools/install-node-wsl.ps1を使用できます。公式SHA-256で検査して専用ディレクトリへ置き、global PATHや通常のNodeを変更しません。

## 起動契約

```text
Gas Town Agent Preset → gt-dsh
  → 固定実体・worktree・専用HOME・profile・model route・資格の検査
    → rdsh --profile deepflow-worker-v2_1
      → DeepSeek Harness + 固定TUI
```

config/gastown/は未登録の設定例です。config/gt-dsh.example.jsonから専用の設定を作り、Gas Townの起動環境へGT_DSH_CONFIGを設定します。ワーカーHOMEとDSH_HOMEはattemptごとに用意します。

```powershell
node adapters/gt-dsh/bin/gt-dsh.mjs --help
node adapters/gt-dsh/bin/gt-dsh.mjs --config C:\work\gt-dsh.local.json --check
```

--checkは起動前検査です。実際のPTY入力受付やgt prime受信を証明しません。通常起動はLinuxに限定しています。設計候補lock、未指定model、未資格profile、実体hashの不一致では起動しません。秘密値を検査結果へ出しません。

worker profileはDeepInfraへの固定経路、worker用tool、委譲・認証探索・観測送信の停止を設定済みです。固定したビルド済みソースへのconsumerリンクで実行しました。TUIの可搬tarballとprivate repo用のread/network境界・privacy canaryは未合格です。公開fixture専用の資格は通常CLIで受け付けません。

モデルの3段階は[model-tiers.json](config/model-tiers.json)へ保存しています。headはGLM-5.3、mediumはGLM-5.3-Flash、lowerはDeepSeek-V4.1-Flashです。今回はlowerで実行しました。3段階のGas Town役割割当とGLM側の実ジョブは未検証です。APIキーはGit・npmの両方から除外した`.env.deepinfra.local`で保持し、値をprofileやlockへコピーしません。空の設定例は[deepinfra.env.example](config/deepinfra.env.example)です。

## 設計と検証

- 正本: [設計v2.1](docs/design-v2.1/DESIGN_V2_1.md)
- 試験仕様: [Acceptance v2.1](docs/design-v2.1/ACCEPTANCE_V2_1.md)
- 実装の証跡: [検証記録](docs/IMPLEMENTATION_STATUS.md)
- 実モデル1ジョブ: [実E2E記録](docs/REAL_E2E.md)
- 起動lock契約: [アダプター仕様](adapters/gt-dsh/README.md)
- 新規リポジトリの範囲: [構成の分離](docs/MIGRATION.md)

本リポジトリの実行入口はgt-dshです。アダプター、設定、契約試験、公開用検証記録を収録しています。固定runtimeのビルド・実E2E用スクリプトは[tools](tools/)にあります。現在は検証時のローカル保存先を参照するため、通常運用向けの可搬インストーラーとしては未完成です。

## ライセンス

独自接続コードは[MIT](LICENSE)です。外部OSSは固定した配布物のライセンスに従います。[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)を参照してください。

利用するOSSと開発者への[謝辞](ACKNOWLEDGEMENTS.md)、[固定参照・license台帳](third_party/upstream-sources.json)、[開発依存SBOM](third_party/adapter-dev.sbom.cdx.json)を公開しています。[公開・リリース基準](docs/RELEASE.md)では、実キー・Git履歴・配布物の検査と、実験版から安定版へ進む条件を定めています。現在はregistry発行を無効にした実験版アダプターです。

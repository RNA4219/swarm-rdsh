# 公開・リリース基準

このrepositoryはMITの接続アダプターと設定・検証資材を公開します。現段階の配布対象は実験版アダプターです。通常deploymentの資格はblockedで、完全な自律Swarm、private repo、16/100並列を保証する安定版にはしていません。

## 公開できる内容

npm形式のtarballにはビルド済みgt-dsh、設定例、文書、謝辞、上流のライセンス、開発依存のSBOMを含めます。DSH・TUI・rustdsh・Gas Town・Beads・Dolt・Nodeの実行資材、モデル、APIキー、Session本文、試験town、旧Python runtimeは含めません。上流runtimeは利用者が固定参照から別途用意します。TUIの可搬runtime packageとその完全な推移依存SBOMは未完成です。

swarm-rdshは独立したGit履歴の新規リポジトリです。旧Python source・Compose・旧Git履歴はアーカイブ済みの別リポジトリへ保存しています。APIキーはignoredのローカルenvに保持し、Git履歴・公開検証記録・配布物から除外します。

## mainへの統合前の必須検査

1. typecheck・lint・build・Linux contract/lifecycle/integrationが合格する。
2. 原本設計4件のdigestが一致する。
3. Git追跡対象、未ignoredの公開候補、index、全refから到達できるGit objectを秘密値なしで検査する。
4. ローカルでは設定済みDeepInfra APIキーをメモリ内で比較し、平文・base64・URL encodingの混入がないことを確認する。CIは汎用token/秘密鍵patternを検査し、実キー照合済みとは表示しない。
5. 新しくpackした全entryを検査し、APIキー・private env・local config・旧runtimeの混入がないことを確認する。展開したCLIのhelpを実行する。
6. 独自MIT、OSS名・固定参照・LICENSE/NOTICE・謝辞、SBOMのscopeと制約が配布物に入っていることを確認する。
7. 公開説明で未検証を合格へ変更しない。実行証跡に手動介入や失敗を残す。
8. 同じPR headのCI合格後、マージ直前に実キーの除外を再確認し、head SHAを固定してマージする。admin bypassで未合格checkを飛ばさない。

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm test
pnpm run check:design
pnpm run generate:sbom
npm pack --ignore-scripts --pack-destination .runtime/distribution
pnpm run check:package
node tools/check-secrets.mjs --require-key --archive .runtime/distribution/swarm-rdsh-0.2.1-dev.0.tgz
pnpm run check:release
```

pnpm testのPOSIX試験はLinuxで実施します。WindowsではWSLかCIを使います。`--require-key`は公開maintainerのマージ前検査用で、キー未配置のclone/CIでは付けません。結果は値を含めず`.runtime/secrets-check.json`に保存します。APIキーをCI secretやモデル入力へコピーして検査しません。

## リリース時の追加条件

GitHub Releaseやnpm registryへの発行はmainへのマージと別の操作です。発行対象commit、version、配布形式、検証範囲を決め、同一commitからclean checkoutでbuild/packし、checksumを付けます。現在のpackageは`private: true`でregistryへの誤発行を止めています。registry発行時は公開package名・所有権・versionを確認して切り替えます。

安定版Swarmとして発行する前には、固定DSH/TUIの正式互換性、全実効tool、privacy canaryとlifecycle通信、継続入力、自動復旧、保護されたRefinery統合、DAG・同時dispatch、全役割と3段階モデル、16並列の測定を完了します。100並列は別の実測条件です。未達なら実験版の制約を表示し、通常deploymentを有効化しません。

上流runtimeを再配布する場合は、今回のadapter用SBOMだけで済ませず、上流の全推移依存・native資材・LICENSE/NOTICE・必要なソース提供条件を改めて確認します。

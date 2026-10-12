# 新規リポジトリへの構成の分離

swarm-rdshは、Gas Town / BeadsとDeepSeek Harness・rustdshを接続する新規リポジトリです。旧DeerFlow / OpenCode構成の[RNA4219/deepflow-swarm](https://github.com/RNA4219/deepflow-swarm)はアーカイブ状態で保存します。

## 収録するもの

- 添付設計v2.1の6ファイル。原本で固定した4件のSHA-256を検査します。
- gt-dshの接続アダプター、Gas Town設定例、DSH worker profile、モデル経路の設定例。
- 固定runtimeのビルド資材を準備するスクリプト、契約試験、公開fixtureでの実モデル検証記録。
- MITライセンス、謝辞、採用OSSの固定参照とライセンス全文、開発依存SBOM、公開前検査とCI。

旧Python制御基盤、旧Docker / Compose、旧依存lock、旧Git履歴は取り込みません。独立したGit履歴で開発・PR・リリースを管理します。

## 引き継いだ検証記録

接続コードは、公開前にローカルで準備した設計v2.1の実装から引き継ぎました。原本設計はbyte単位で保持し、実モデルによるworker完了・Refinery統合・TUI公開注入APIの照合結果を[REAL_E2E.md](REAL_E2E.md)と[公開証跡](evidence/qualification-20261013.json)に収録しています。

検証済み実行資材とSessionの正本は、元のローカルWSL保存先`/home/ryo-n/.local/share/deepflow-swarm/`へ維持しています。この保存先の名前は旧制御基盤への依存を示すものではありません。現在のビルド・fixtureスクリプトはこの固定保存先を参照する検証資材で、可搬インストーラーとしては未完成です。

旧リポジトリの未コミット変更と保護backupは保存します。旧DB・volume・インストール済み旧CLIの撤去は、本リポジトリの公開処理では行いません。

通常deploymentの資格は引き続きblockedです。公開fixtureの成功から、private repo、全Gas Town役割、自動復旧、保護PRでのRefinery統合、16/100並列の合格を推定しません。

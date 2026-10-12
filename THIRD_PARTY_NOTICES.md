# 第三者ソフトウェアとライセンス

swarm-rdshの独自コードは[MIT](LICENSE)で公開します。外部ソフトウェアの
ライセンスはそれぞれの著作権者に帰属し、本プロジェクトのMIT表記で置き換えません。

## v2.1の新主経路

| プロジェクト | ライセンス | 採用範囲 |
|---|---|---|
| Gas Town / Beads | MIT | 固定Gas TownとBeads CLI 1.0.5をビルド。公開fixtureのタスク・投入・完了・MQに使用 |
| DeepSeek Harness | MIT | 固定0.2.1-alpha.2をnative/library build。agent loop・Session・toolに使用 |
| rustdsh | MIT | 固定0.3.2をビルド。起動と高速ユーティリティ |
| ccch1mneyyy/dsh-TUI | MIT | 固定0.14.0とvendorをビルド。推移依存のSBOM・license棚卸しと可搬配布は未完了 |
| T-Auto/dsh-std | MIT | TUIの固定vendor。参照SHAとMIT全文を保存 |
| Dolt | Apache-2.0、配布物内の依存は各license | 公式2.0.7の配布archiveをchecksum照合して使用。元のLICENSESを保持 |

新しいnpm packageには独自adapter・設定・文書・ライセンスを含め、上流の実行バイナリは同梱しません。NodeのWSL配布物は公式archive内のLICENSEを保持して専用領域へ配置しています。BeadsのMIT全文とDolt配布物のLICENSESもthird_party/licensesへ保存しました。固定source・runtime・build lockはupstream.lock、実行範囲はdocs/REAL_E2E.mdを参照してください。dev依存はpnpm-lock.yamlへ固定しました。

OSS名と謝辞は[ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md)、固定参照とlicense digestは[upstream-sources.json](third_party/upstream-sources.json)に記載しています。アダプターはNode標準libraryだけをruntime依存として使い、npmの外部runtime依存をbundleしません。122件の開発依存は[adapter-dev.sbom.cdx.json](third_party/adapter-dev.sbom.cdx.json)へ、MIT、Apache-2.0、Python-2.0、BSD-2-Clause、BSD-3-Clause、ISCのlicense情報とともに記録しています。このSBOMは外部DSH/TUI等の全推移依存の代わりにはなりません。

## 配布境界

このGitリポジトリとnpm形式のtarballは、独自の接続コード、設定、文書、ライセンスを含みます。Gitには契約試験と固定runtime用の検証スクリプトも収録します。上流のバイナリ、コンテナimage、モデル重み、APIキー、Session本文は再配布しません。

上流の著作権表記とライセンス全文は[third_party/licenses](third_party/licenses)に保持します。実行資材を別途取得またはビルドする際も、各配布物のLICENSE/NOTICEを維持してください。全runtimeを再配布する場合の条件は[公開・リリース基準](docs/RELEASE.md)に記載します。

## 周辺機能の候補

設計原本で挙げるOpenSandbox、LiteLLM、Langfuseは現時点で未接続です。採用時に対象version・利用機能・配布範囲を固定し、LICENSE/NOTICEと推移依存の確認を追加します。原本の候補一覧を、この配布物に同梱したコードの一覧として扱いません。

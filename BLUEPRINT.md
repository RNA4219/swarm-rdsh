# swarm-rdsh 構成

設計の正本は[DESIGN_V2_1.md](docs/design-v2.1/DESIGN_V2_1.md)です。元のv2.0採用構成を維持し、保証範囲・依存固定・受入条件はv2.1に従います。

新主経路はGas Town / Beads → gt-dsh → rustdsh → DSH。既存OSSの公開接続境界を使い、同じ責務の実装を重ねません。

固定runtime/TUIのビルドとworker profileを用い、公開fixtureで実モデルの1ジョブを実行しました。Gas Townの手動復旧を挟み、コード修正・検証・gt done・Beads完了・Refineryキュー登録に続き、既存Refineryによる統合・統合後テスト・MQ cleanupを確認しました。通常nudge、自動復旧、保護PRでの統合、privacy、並列は未合格です。[実E2E記録](docs/REAL_E2E.md)と[実装状態](docs/IMPLEMENTATION_STATUS.md)を参照してください。

DeerFlow / OpenCode構成はアーカイブ済みの別リポジトリです。swarm-rdshへ引き継ぐ接続コードと検証記録の範囲は[構成の分離](docs/MIGRATION.md)に記載します。

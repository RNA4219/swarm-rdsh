# v2.1 設計更新一式

`DESIGN_V2_1.md`が正本。v2.0と矛盾する保証・設定・試験を置き換える。

`ACCEPTANCE_V2_1.md`は未実施の受入試験仕様。
`worker-profile.policy.json`は構成の宣言的仕様で、インストール済みprofileではない。
`privacy.override.cordis.yml`は固定DSHの既知行に対する停止候補で、単独ではread/network制限を実現しない。
`upstream.lock`は設計候補lock。必須の実体や試験が未確定なのでstatus=blocked。デプロイに使用しない。

DSH・TUIソース固定とローカル設計ファイルのhashは、ビルド成功・組合せ互換・安全性の証明ではない。
GitHub、既存作業ツリー、Git tag、volumeは変更していない。

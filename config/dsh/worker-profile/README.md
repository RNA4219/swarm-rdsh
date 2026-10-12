# Gas Town worker profile

DSHの公開profile manifest形式でbaseと固定TUIを読み込みます。固定ソース・vendor・依存lockからビルドしたDSHとTUIへのconsumerリンクを専用DSH_HOMEに配置し、公開fixtureの1ジョブを実行しました。実行資材はWSLの`/home/ryo-n/.local/share/deepflow-swarm/`にあります。上流ソースは変更していません。

`cordis.patch.yml`はアダプターが渡すprovider・model・endpointを使用します。worker presetはpersona、instructions、bash、filesystem、filesystem searchだけで構成し、Workflow/Subagent、認証探索、更新監視、観測送信、別のモデル選択を停止しています。合成設定の静的検査と実際のbash/read/edit使用を確認しました。実効tool全件の動的棚卸しとprivacy canaryは未実施です。

TUI 0.14.0の宣言するDSH version範囲には固定DSH 0.2.1-alpha.2が含まれません。fixtureでは公式`dsh plugin allow-version`をその組合せだけに使用しました。TUIのdev依存も、consumer側で固定DSHへ接続しています。正式互換性を合格にはしていません。

`fixture-only.patch.yml`は外側をbubblewrapで隔離した公開fixture専用です。Gas Town状態への書込みを試験town内で許可します。private repoや通常profileへコピーしません。通常のHOME、DSH_HOMEは変更していません。

可搬TUI tarballは未完成です。hoisted依存のpackを試すと固定lockのoptional platform依存で失敗したため、元のisolated依存を復元しました。このmanifest単独はnpm installerではありません。正式なdeployment lockはprivacy、互換性、PTYの全資格が揃うまでblockedです。[実E2E記録](../../../docs/REAL_E2E.md)を参照してください。

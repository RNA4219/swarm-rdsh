# gt-dsh 接続アダプター

実装はsrc/adapter.tsとsrc/cli.tsです。pnpm run buildでlib/gt-dshへビルドし、bin/gt-dsh.mjsが読み込みます。起動前検査と1回の子process委譲のみを担当します。

## 設定

config/gt-dsh.example.jsonのruntime項目とmodel routeを確定してください。pathは固定した実行資材と必要なsystem toolsのディレクトリ一覧です。host PATH、proxy、Node preload、汎用GitHub token、旧Session IDをコピーしません。

Gas Town識別情報のallowlistは固定internal/config/env.goのAgentEnvから抽出したrole/rig/worker、BD_ACTOR、Dolt接続情報に、実接続で必要なtown、Git identity、tmuxを加えています。AgentEnvが明示的に消すBEADS_DIR等のtarget selectorや、Claude用設定、OTel設定は渡しません。公開fixtureのgt prime・Git commit・gt doneを確認済みです。全役割は未検証です。

Gas Townのprompt_modeはargです。初期指示を一つのliteral argvとして`rdsh ... -- <prompt>`へ渡します。shell展開は行わず、--checkは指示本文を表示しません。空・NUL・64KiB超の指示を拒否します。

## deployment lock契約

現行upstream.lockはdesign-candidate-not-deploymentなので拒否されます。qualified設定に使うlockには次を必要とします。

- kind: deployment、status: ready、空のrequired_unresolved。
- source_candidatesにv2.1のGas Town/DSH/rustdsh/TUIの完全SHA。
- model_routeに設定と一致するprovider/id/endpoint/api_key_env。
- runtime_artifactsのrdsh/dsh/nodeに絶対path/sha256。nodeは実行中のversionも一致させる。
- profile_filesにDSH_HOME相対pathとsha256。少なくともprofileのpackage.json、profile patch、DSH_HOME最終patchを含む。
- qualification.build/profile_composition/privacy_canary/pty_e2e: passed。

実体hashを確認し、profileのbundlesがDSH baseと固定TUIだけであることを検査します。記録値を手でpassedへ変更して資格を作りません。信頼された運用側が実試験の証跡とともにlockを生成する必要があります。deployment lock生成・署名の仕組みと実profileの推移依存検査は未実装です。

--checkは上記の起動前検査です。Model endpointの実使用、実効tool、PTY受信、Gas Townとの完了連携、read/network境界を動的に検証する機能ではありません。

通常起動はLinuxのみです。Node 24のexecveでprocessを置換し、PID・stdio・ターミナルの信号を保持してrdshへ委譲します。再試行しません。子processへの信号伝搬helperも契約試験で確認しています。通常presetのprocess_namesはnode/MainThread/rdsh、bubblewrap fixtureでは観測したbwrapを加えます。Escによる中断や継続nudgeの契約は未合格です。

tools/qualify-worker.mjsは公開fixture専用入口です。qualification-fixture lock、公開fixture marker、Git/workspace/HOMEの範囲を検査した上で外側をbubblewrapに接続します。通常CLIはこのlockを拒否します。独立Scheduler・job retry・会話履歴ストアは持ちません。[実E2E記録](../../docs/REAL_E2E.md)を参照してください。

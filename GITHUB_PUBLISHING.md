# GitHub公開準備

このリポジトリは、そのままGitHubへ移せる構成です。元素材、プロジェクトの編集データ、書き出したMP4は含みません。

## 推奨構成

- ソースコード: ShingoさんのGitHubリポジトリ
- ブラウザ版: GitHub Pages（`dist/`）
- Mac版: `dist/personal-video-editor-mac.zip`をGitHub Releasesへ添付
- 日常の編集: GitHub Pages上ではiPhone／ブラウザの端末エンジン、Macの高品質処理はZIPを展開して`Launch.command`

## 公開手順

1. GitHubで新しい空のリポジトリを作成します。
2. このリポジトリをpushします。
3. Repository Settings → Pages → Sourceで「GitHub Actions」を選びます。
4. Actions → `Publish GitHub Pages` → `Run workflow`を実行します。
5. Mac版を配布する場合はReleaseを作り、Actionsの実行後に生成された`personal-video-editor-mac` artifact内のZIPを添付します。

`Publish GitHub Pages`は手動実行だけにしてあります。リポジトリへpushしただけではアプリを公開しません。公開リポジトリにする場合は、ライセンス方針を決めてからLICENSEを追加してください。

通常のpushとPull Requestでは `Validate editor` がJavaScriptテスト、静的ビルド、Python動画処理テスト、Mac ZIP生成を実行します。FFmpegの任意機能がランナーにない場合、その機能はスキップとして記録し、不足機能を処理前に検出できることを確認します。Pages公開はこの検証とは別の手動操作です。

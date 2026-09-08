# PERSONAL VIDEO EDITOR — V1 Preview

フォトグラファーのためのローカル動画編集アプリ。Webの編集画面と、Macで動くネイティブFFmpegエンジンを同梱しています。

**このビルドは動作する検証版です。実際のiPhone素材・Apple Silicon・Safari/Chromeでの受け入れ試験は未実施です。仕様書のV1完成を宣言する版ではありません。**

## Macで起動する

1. ZIPを展開し、フォルダ全体を任意の場所に置いてください。
2. Python 3.9以降と、libx264・zscale・tonemap・vidstab・drawtextを含むFFmpegが必要です。Homebrewを導入済みの場合、以下をターミナルへ貼り付けます。

```bash
brew install python ffmpeg-full
```

3. `Launch.command`を開きます。同じ編集画面がブラウザに開きます。FFmpegは同梱していません。
4. 開かない場合はターミナルへ `bash ` と入力し、続けて `Launch.command` をドラッグしてEnterを押してください。macOSが確認を表示する場合は、内容と配布元をご確認のうえ開いてください。
5. 終了は起動したターミナルで **Control+C** です。起動中はターミナルを閉じないでください。

Homebrew未導入の場合は [brew.sh](https://brew.sh/) の公式手順で導入してください。インストール済みの通常版FFmpegも利用できますが、手ぶれ補正・HDR変換・テキストはビルド構成に依存します。起動スクリプトは `ffmpeg-full` のインストール先を優先します。

## 最初の編集

1. MOV/MP4をドロップするか「動画を選択」。Mac版は原本のコピーを保存し、SDRの720p・30fpsプロキシとサムネイル・音声波形を生成します。
2. タイムラインをクリックしてクリップを選択。I / O、分割 S、トリム、並び替えを使います。通常削除は黒の空白を残し、前詰め削除は空白を作りません。
3. MOTIONで0.05〜20倍速とランプの始点・終点・カーブを設定します。区間は分割で作ります。
4. LOOKでカラー、SOUNDで原音とBGM、TEXTで文字を調整します。
5. ANALYZEで素材全体の候補を表示。Intentを変更したときは再スキャンしてください。候補のボタンを押すまで映像は変更されません。
6. 「処理プレビューを生成」で、カラー・手ぶれ補正・補間・音声を含む540p出力を確認できます。
7. 書き出しでH.264/AAC・SDR MP4を生成し、「MP4を保存」を押します。

Web上のブラウザ版では、再生可能な素材の編集・近似試写・解析・プロジェクト保存を利用できます。Macエンジンにはネット越しに接続しません。本格的な処理はMac版で行います。

## 保存と再開

編集はブラウザへ自動保存し、Mac版ではディスクにも保存します。「保存」または⌘Sで `.project` ファイルをダウンロードできます。ファイルには編集内容と素材の参照が含まれ、動画本体は含みません。

別のブラウザやMacへ移す場合は、.projectを開き、元と同じファイル名・サイズの素材を読み込んで再リンクしてください。Mac版の「開く」では保存済みプロジェクトも選べます。編集履歴は最大60回で、ブラウザを閉じるとリセットされます。

### Mac内の保存先

`~/Library/Application Support/Personal Video Editor/`

- `media/`：読み込んだ動画・BGMのコピーとメタデータ。元の場所の原本は変更しません。
- `cache/`：プロキシ、サムネイル、波形、解析結果、処理プレビュー。
- `projects/`：自動保存したプロジェクト。
- `exports/`：完成MP4。

RAMを抑える代わりにディスクを使用します。元ファイルのコピー、プロキシ、スタビライズ中間映像、音声の一時ファイルを保存できる空き容量が必要です。成功・失敗・キャンセル後、書き出し中間フォルダは削除します。中断されたプロキシの `.part.mp4` は次の再試行で置き換えます。

不要なキャッシュはアプリ終了後にFinderから削除できます。次回IMPORTの「プロキシを生成 / 再試行」で再作成してください。`media/` と `projects/` は必要なプロジェクトが参照していないことを確認してから整理してください。原本・完成MP4・.projectのバックアップを推奨します。

## 実装範囲

| 項目 | このビルド |
|---|---|
| Import / Cut / Trim / Split / Reorder | 実装。メイン1トラック、複数素材 |
| Ripple / Gap delete / Undo / Redo | 実装 |
| Crop / Scale / Position / 比率 | 実装。Original・9:16・4:5・1:1・16:9 |
| 10項目のカラー調整 | 実装。ブラウザ試写はGPU近似、処理出力を基準とします |
| プリセット保存 | 実装。同名上書き可能。ブラウザ内保存 |
| 原音 / BGM / Volume / Fade | 実装。BGMは尺に合わせてループ |
| 最小限のテキスト | 実装。1レイヤーのUI、フォント・位置・整列・透明度・フェード・区間 |
| 0.05〜20倍 / 区間速度 | 実装 |
| Linear / Ease In / Out / In-Out | 実装。32区間の時間積分による近似 |
| Frame duplication / blending | 実装。補間の最終確認は処理プレビュー |
| Stabilization | FFmpeg vidstab 2パス。OFF・WEAK・MEDIUM・STRONG・表現プリセット |
| Best Moment / Motion / Stillness / Anti-Boring | 低解像度の鮮鋭度・輝度・画面差分による候補検出 |
| Intent / Randomizer | 検出の重み・間隔・静止区間閾値へ反映。Randomizerは提案のみ |
| H.264 / AAC MP4 | 実装。1080p・4K・Source。Source FPSは最大60 |
| HDR → SDR | HLG/PQベースのHableトーンマッピング |
| JSONプロジェクト / 自動保存 / 再リンク | 実装 |

## 既知の制約・未検証

- 実機のiPhone HEVC/HDR/Dolby Vision、長尺VFR、Safari/Chromeでの再生、Apple Siliconでの性能、Instagram実投稿は未検証です。合成素材によるネイティブ処理試験を同梱しています。
- HDRはHLG/PQベースレイヤーの変換です。Dolby Vision動的メタデータは処理しません。Profile 5または伝達関数不明のHDRは停止します。HDR出力はありません。
- プロキシは30fpsです。高FPS/VFRの1フレーム送りは平均FPSによる時刻移動で、原本の厳密なフレーム選択は未対応です。
- 極端な速度のブラウザ試写はシーク駆動による近似です。0.25倍未満・4倍超の原音は試写中ミュートします。最終レンダリングはPTS基準です。
- ランプは32分割近似です。音声は区間ごとにピッチを維持して処理しますが、急変部や極短区間では音のつなぎ目が聞こえる場合があります。BGM主体の演出では原音ミュートを選べます。
- ランプを分割すると区間ごとにイージングが再計算されます。分割前の厳密なカーブ形状は保存されません。Bezier編集は未実装です。
- GPUカラー試写はFFmpegと完全一致しません。手ぶれ補正・ブレンド・1.0を超える音量も処理プレビューで確認してください。
- 手ぶれ補正の事前クロップ推定・光学フロー・AI補間・顔/視線/ポーズの意味認識・写真ルック転写・ビート検出・ジャイロ・自動追尾クロップは未実装です。
- J/Lは前後1秒の移動です。逆再生シャトルは未実装です。
- CPUのlibx264を採用しています。VideoToolboxは能力を検出しますが、実機検証が済むまで自動選択しません。
- UIの実ブラウザ操作・視覚QAはこの環境では未実施です。HTML参照、JavaScript構文、時間モデル、HTTP API、実FFmpeg出力を検証しています。

## 開発・検証

外部のPythonパッケージやnpm依存はありません。UIは `dist/`、ローカルAPIは `engine/server.py`、処理は `engine/core.py` です。以下はテスト用の一時フォルダに合成映像を作ります。

```bash
python3 tests/validate_pipeline.py
python3 tests/validate_formats.py
python3 tests/server.test.py
node tests/model.test.mjs
```

詳細は `VALIDATION.md` と `validation/` を参照してください。

## 技術参照

- [WebCodecs仕様](https://www.w3.org/TR/webcodecs/)：コーデック対応は実装に依存するため、HEVCをブラウザの必須機能と仮定しません。
- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)：setpts、atempo、zscale、tonemap、vidstab、framerate、drawtext等。
- [Homebrew ffmpeg-full](https://formulae.brew.sh/formula/ffmpeg-full)：libvidstab等を含む構成。2026-09-08確認。
- [Apple HDR metadata](https://developer.apple.com/av-foundation/High-Dynamic-Range-Metadata-for-Apple-Devices.pdf)：iPhone由来HDRの実素材検証に使用する一次資料。

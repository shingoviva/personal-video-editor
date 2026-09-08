# PERSONAL VIDEO EDITOR — V1 Preview · 1.2.0

フォトグラファーのためのローカル動画編集アプリ。Webの編集画面と、Macで動くネイティブFFmpegエンジンを同梱しています。

**このビルドは動作する検証版です。添付されたH.264/SDR実写素材と合成素材で処理を検証し、クラウドChromeで一部UI操作を確認しました。Apple Silicon・Safari・実写HEVC/HDRの受け入れ試験は未実施です。仕様書のV1完成を宣言する版ではありません。**

## iPhoneで編集する

1. アプリのURLを **Safari** で開きます。
2. 「動画を選択」から写真ライブラリまたはファイルを開きます。再開用の素材も、この端末内に保存します。
3. CUT / MOTION / LOOK / SOUND / TEXTで編集します。並び替えはCUTの「前へ」「後へ」で行えます。
4. 「書き出し」→「この端末でMP4を書き出す」。まず1080p・30fpsを推奨します。処理中はSafariを開いたままにしてください。
5. 完成後「写真・ファイルへ保存」→iOSの共有画面の「ビデオを保存」または「ファイルに保存」。共有できないブラウザではダウンロードリンクを使います。
6. IMPORTの「前回のMP4を開く」から保存をやり直せます。「端末版の対応状況」では1秒の合成素材を使う端末テストも実行できます。

**iPhone実機の受け入れ試験は未完了です。端末版ではHDRの正確なSDR変換は未対応で、速度変更した原音は音程も変化します。手ぶれ補正は平行移動のみです。** 対応しない素材やコーデックは停止し、編集内容を保持します。詳細はVALIDATION.mdを参照してください。

写真ライブラリの原本は変更しません。プロジェクトの「保存」は編集JSONを共有・ダウンロードします。動画本体は含まれません。端末のブラウザデータ削除に備え、元素材と完成MP4は写真/ファイルに残してください。

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

Web上の端末版では、対応コーデックの素材の編集・近似試写・解析・プロジェクト保存・端末内MP4書き出しを利用できます。Macエンジンにはネット越しに接続しません。正確なHDR変換とvidstab補正はMac版で行います。

## 保存と再開

編集はブラウザへ自動保存し、Mac版ではディスクにも保存します。「保存」または⌘Sで `.project` ファイルをダウンロードできます。ファイルには編集内容と素材の参照が含まれ、動画本体は含みません。

別のブラウザやMacへ移す場合は、.projectを開き、元と同じファイル名・サイズの素材を読み込んで再リンクしてください。Mac版の「開く」では保存済みプロジェクトも選べます。編集履歴は最大60回で、ブラウザを閉じるとリセットされます。

### Mac内の保存先

`~/Library/Application Support/Personal Video Editor/`

- `media/`：読み込んだ動画・BGMのコピーとメタデータ。元の場所の原本は変更しません。
- `cache/`：プロキシ、サムネイル、波形、解析結果、処理プレビュー。
- `projects/`：自動保存したプロジェクト。
- `exports/`：完成MP4。
- `logs/`：処理段階・所要時間・検証結果・FFmpegエラーの診断記録。失敗画面からダウンロードできます。

RAMを抑える代わりにディスクを使用します。元ファイルのコピー、プロキシ、スタビライズ中間映像、音声の一時ファイルを保存できる空き容量が必要です。成功・失敗・キャンセル後、書き出し中間フォルダは削除します。生成中は一時ファイルを使い、検証に通った出力だけを確定します。生成ファイルが不完全な場合は1回だけ再生成します。入力形式や設定のエラーは自動再試行しません。最終MP4は全尺をデコードして検証するため、その分だけ完了まで時間がかかります。

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

- 実機のiPhone HEVC/HDR/Dolby Vision、長尺VFR、Safariでの再生、Apple Siliconでの性能、Instagram実投稿は未検証です。合成素材によるネイティブ処理試験を同梱しています。
- HDRはHLG/PQベースレイヤーの変換です。Dolby Vision動的メタデータは処理しません。Profile 5または伝達関数不明のHDRは停止します。HDR出力はありません。
- プロキシは30fpsです。高FPS/VFRの1フレーム送りは平均FPSによる時刻移動で、原本の厳密なフレーム選択は未対応です。
- 極端な速度のブラウザ試写はシーク駆動による近似です。0.25倍未満・4倍超の原音は試写中ミュートします。最終レンダリングはPTS基準です。
- ランプは32分割近似です。音声は区間ごとにピッチを維持して処理しますが、急変部や極短区間では音のつなぎ目が聞こえる場合があります。BGM主体の演出では原音ミュートを選べます。
- ランプを分割すると区間ごとにイージングが再計算されます。分割前の厳密なカーブ形状は保存されません。Bezier編集は未実装です。
- GPUカラー試写はFFmpegと完全一致しません。手ぶれ補正・ブレンド・1.0を超える音量も処理プレビューで確認してください。
- 手ぶれ補正の事前クロップ推定・光学フロー・AI補間・顔/視線/ポーズの意味認識・写真ルック転写・ビート検出・ジャイロ・自動追尾クロップは未実装です。
- J/Lは前後1秒の移動です。逆再生シャトルは未実装です。
- CPUのlibx264を採用しています。VideoToolboxは能力を検出しますが、実機検証が済むまで自動選択しません。
- クラウドChromeで合成H.264素材の読み込み、WebGL表示、再生/停止、分割、ランプ設定、画角、ルックUndo/Redo、自動保存後の復帰と再リンク、スキャン候補表示を確認しました。全操作・音声品質・滑らかさの評価は未完了です。
- `.project` ダウンロードは検証ブラウザで完了イベントを取得できず、実機確認が必要です。自動保存の復帰とMac APIの保存/読込は検証済みです。
- 実素材の手ぶれ補正で一度、不完全な中間MP4を検出しました。元の原因は未特定です。1.1.0では中間出力の検証・限定再試行・診断ログを追加し、実素材の同条件試験は2回成功しています。

## 開発・検証

利用時に追加するPythonパッケージ・npm依存はありません。端末版のメディア処理ライブラリは同梱しています。開発時のブラウザ確認のみViteを使用します。Mac版の利用者がnpmを入れる必要はありません。UIは `dist/`、ローカルAPIは `engine/server.py`、処理は `engine/core.py` です。以下はテスト用の一時フォルダに合成映像を作ります。

```bash
python3 tests/validate_pipeline.py
python3 tests/validate_formats.py
python3 tests/server.test.py
python3 tests/reliability.test.py
node tests/model.test.mjs
node tests/media-state.test.mjs
node tests/mobile.test.mjs
node tests/mobile-container.test.mjs
```

詳細は `VALIDATION.md` と `validation/` を参照してください。

## 技術参照

- [WebCodecs仕様](https://www.w3.org/TR/webcodecs/)：コーデック対応は実装に依存するため、HEVCをブラウザの必須機能と仮定しません。
- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)：setpts、atempo、zscale、tonemap、vidstab、framerate、drawtext等。
- [Homebrew ffmpeg-full](https://formulae.brew.sh/formula/ffmpeg-full)：libvidstab等を含む構成。2026-09-08確認。
- [Apple HDR metadata](https://developer.apple.com/av-foundation/High-Dynamic-Range-Metadata-for-Apple-Devices.pdf)：iPhone由来HDRの実素材検証に使用する一次資料。

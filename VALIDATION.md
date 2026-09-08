# Validation — 2026-09-08

検証環境：Linux x86_64、FFmpeg 6.1系、Python 3.12、Node.js。素材はすべて合成したテスト映像です。Apple Siliconでの速度測定・ブラウザUI試験・iPhone実写素材の色評価・SNS実投稿は未実施です。

## 処理パイプライン

| 試験 | 結果 |
|---|---|
| 4K・60fps・10bit HEVC/HLG生成 → SDRプロキシ | PASS |
| HLG HEVC 4K → 1080p60 H.264 Rec.709 | PASS |
| VFRの検出 → CFR出力 | PASS |
| 120fps音声なし → H.264/AAC | PASS |
| 240fps入力 → 60fps出力 | PASS |
| Trim / 9:16 Crop / 音量・Fade | PASS |
| 0.05倍・20倍 | PASS |
| Ease In/Out 0.1→8倍 + 原音同期 | PASS |
| Frame blending + color + text + hold | PASS |
| vidstab検出・補正2パス | PASS |
| 複数クリップ + 黒の空白 + BGM | PASS |
| Best Moment・Intent別の特徴量解析 | PASS |
| キャンセル | PASS |
| 元素材ハッシュ不変 | PASS |

出力はffprobeでコーデック・映像寸法・映像と音声の長さを確認しています。AACパケットとフレーム境界の丸めによる差を認め、映像/音声の長さ差と期待尺の差は150ms以内を合格条件にしました。ケース別の実測値は `validation/pipeline.json` を参照してください。

解析の全カテゴリはアルゴリズムを実装していますが、実写の検出品質を評価した結果ではありません。表情・ポーズ・視線の意味認識や専門家による候補の採点は含みません。

## 状態・API

- JavaScriptの構文検証：PASS。
- 時間マッピングの相互変換、0.05〜20倍、4種のランプ、空白、プロジェクトJSON：PASS。
- ローカルAPI：未認証拒否、別Origin拒否、メディアのRange配信、ディスク保存/復元、ストリーム読み込み、非同期プロキシジョブ：PASS。
- 実ブラウザでのDOM操作・WebGL表示・HEVCデコード・音声試聴は未実施。

## メモリ

4K60 HEVC/HLG → 720p30 SDRプロキシ相当のFFmpeg処理、入力とフィルタ・エンコーダのスレッド数を2に制限して測定。

| 入力尺 | 子プロセスの最大RSS |
|---|---:|
| 0.6秒 | 377.5 MiB |
| 6秒 | 379.6 MiB |

短尺で、動画の長さに比例したフレーム蓄積が生じないことを確認しました。長時間稼働・全機能・実機でのリークがないことを保証する測定ではありません。詳細は `validation/memory.json`。

## 採用構成と理由

- HTML/CSS/ES modules：依存パッケージなしで配布し、同じ画面をブラウザとMacで使用。
- HTMLVideoElement＋WebGL：低負荷の近似試写。4KはMacでプロキシ化。
- ネイティブFFmpeg：HEVC、HDR、VFR、vidstab、H.264/AACを同じパイプラインで処理。
- Web Worker：ブラウザのフレーム特徴量計算。毎フレームの画素バッファは処理後に解放。
- Python標準ライブラリ：ローカルHTTPとジョブ制御。127.0.0.1にのみバインドし、起動トークンで認証。
- CPU libx264：この環境で検証できるエンコーダを採用。VideoToolboxは能力の検出のみ。
- FFmpeg.wasm：大きな素材の複製・メモリ圧迫・スタビライズ構成の制約を避けるため、この版では不採用。
- WebCodecs：コーデック対応がブラウザ実装に依存し、HEVC/HDRを必須とするV1の主エンジンには不採用。

## V1受け入れ前に必要な実素材試験

1. iPhoneのSDR 4K60、Dolby Vision/HLG、1080p120/240、縦動画、長尺VFRを各1本。
2. ShingoさんのApple Silicon Macで起動し、ブラウザの動画再生とプロキシ生成を確認。
3. 肌・白い衣服・照明ハイライトを含む映像で、HDR→SDRとカラーの色を評価。
4. 激しいパン・歩き撮り・髪や服の動きで、スタビライズと候補検出を評価。
5. ランプ境界の音、数十分の連続編集、キャンセルと再試行、終了後の再開を確認。
6. Instagramへ実投稿し、画角・再生・色・音声を確認。

未検証項目を合格扱いにはしていません。詳しい操作上の制約は README.md を参照してください。

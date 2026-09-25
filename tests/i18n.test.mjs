import assert from 'node:assert/strict';

const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
const {currentLanguage,setLanguage,translate}=await import('../dist/i18n.js');

assert.equal(currentLanguage(),'ja');
setLanguage('en');
assert.equal(values.get('pve.language'),'en');
assert.equal(translate('素材を選択'),'Choose media');
assert.equal(translate('V2へ配置'),'Place on V2');
assert.equal(translate('手ぶれ補正は処理プレビューで確認'),'Check stabilization in processed preview');
assert.equal(translate('装飾なしの標準テキスト'),'Plain standard text');
assert.equal(translate('白文字と細い黒フチ'),'White text with a thin black stroke');
assert.equal(translate('Noto Sans JP · Web'),'Noto Sans JP · Web');
assert.equal(translate('黒浮かせ in'),'黒浮かせ in');
const helpText='保存されるのは編集状態です。元素材は変更されません。別端末で開く場合は候補から元素材を再リンクします。';
const helpEnglish=translate(helpText);
assert.equal(helpEnglish,'The project file stores the edit state. Source media remains unchanged. On another device, choose candidates to relink the source media.');
setLanguage('ja');
assert.equal(translate('Choose media'),'素材を選択');
assert.equal(translate('Check stabilization in processed preview'),'手ぶれ補正は処理プレビューで確認');
assert.equal(translate('Plain standard text'),'装飾なしの標準テキスト');
assert.equal(translate(helpEnglish),helpText);
assert.equal(translate('Noto Sans JP · Web'),'Noto Sans JP · Web');
console.log('JA/EN translation, dynamic phrases and language persistence: PASS');

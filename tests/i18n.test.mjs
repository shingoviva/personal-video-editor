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
setLanguage('ja');
assert.equal(translate('Choose media'),'素材を選択');
assert.equal(translate('Check stabilization in processed preview'),'手ぶれ補正は処理プレビューで確認');
console.log('JA/EN translation, dynamic phrases and language persistence: PASS');

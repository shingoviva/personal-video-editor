import assert from 'node:assert/strict';
import {sanitizeTexts} from '../dist/model.js';
import {textStyle} from '../dist/text-render.js';

const [text]=sanitizeTexts([{id:'title',text:'東京\nNIGHT',font:'Serif',align:'right',weight:'800',color:'#f2c8b0',box:'dark',outline:12,size:500,x:2,y:-1,opacity:2,fadeIn:8,fadeOut:-2,motion:'rise',motionDuration:4,start:1,end:0}]);
assert.equal(text.text,'東京\nNIGHT');
assert.equal(text.weight,800);
assert.equal(text.outline,8);
assert.equal(text.size,300);
assert.equal(text.x,1);
assert.equal(text.y,0);
assert.ok(text.end>text.start);
assert.deepEqual(textStyle(text),{font:'Serif',align:'right',weight:800,color:'#f2c8b0',outline:8,box:'dark'});
assert.equal(sanitizeTexts(Array.from({length:25},(_,i)=>({text:String(i)}))).length,20);
assert.equal('raster' in sanitizeTexts([{text:'safe',raster:{data:'large'}}])[0],false);
console.log('Text layers: validation, style and persisted raster exclusion PASS');

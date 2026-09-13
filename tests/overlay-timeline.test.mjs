import assert from 'node:assert/strict';
import {bindOverlayTimeline,snapOverlayStart} from '../dist/overlay-timeline.js';

let result=snapOverlayStart(4.94,.5,{duration:10,pixels:1000,targets:[5]});
assert.equal(result.start,5);assert.equal(result.snapped,true);assert.equal(result.target,5);
result=snapOverlayStart(4.45,.5,{duration:10,pixels:1000,targets:[5]});
assert.equal(result.start,4.5);assert.equal(result.snapped,true);
result=snapOverlayStart(4.94,.5,{duration:10,pixels:1000,targets:[5],bypass:true});
assert.equal(result.snapped,false);assert.ok(Math.abs(result.start-4.933333333333334)<1e-8);
assert.equal(snapOverlayStart(9.8,1,{duration:10,pixels:1000}).start,9);

const effect={id:'fx',start:1,duration:.5},text={id:'text',start:2,end:3};
const makeElement=dataset=>({dataset,style:{},classList:{add(){},remove(){}},setPointerCapture(){}}),fxElement=makeElement({fx:'fx'}),textElement=makeElement({textChip:'text'});
const root={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[fxElement,textElement]};
let begins=0,finishes=0,cancels=0,previews=[];
bindOverlayTimeline({root,effects:[effect],texts:[text],duration:10,targets:()=>[3.02,4],snap:()=>true,select(){},begin(){begins++},finish(){finishes++},cancel(){cancels++},preview:(item,kind,snap)=>previews.push({item,kind,snap})});
const event=(x)=>({button:0,pointerId:1,clientX:x});
fxElement.onpointerdown(event(100));fxElement.onpointermove(event(300));fxElement.onpointerup(event(300));
assert.equal(effect.start,3.02);assert.equal(previews.at(-1).snap.snapped,true);
textElement.onpointerdown(event(100));textElement.onpointermove(event(297));textElement.onpointerup(event(297));
assert.equal(text.start,4);assert.equal(text.end,5);
assert.equal(begins,2);assert.equal(finishes,2);assert.equal(cancels,0);

console.log('FX/Text timeline drag: arbitrary placement, playhead/edit-point snap, duration preservation and magnetic placement PASS');

import assert from 'node:assert/strict';
import {project,clip,sequence,sourceOffset,timing} from '../dist/model.js';
import {outputSettings,sourceTime,gainAt,mixWindow,limitStereo} from '../dist/mobile-model.js';
import {translation,smoothPath,correctionAt} from '../dist/mobile-stabilize.js';
import {safeName} from '../dist/device-save.js';
const p=project(),m={id:'source',width:3840,height:2160,fps:240,duration:12};p.media=[m];p.clips=[clip(m)];
p.aspect='9:16';assert.deepEqual([outputSettings(p).width,outputSettings(p).height],[1080,1920]);p.export.fps='Source';assert.equal(outputSettings(p).fps,60);
p.export.resolution='4K';assert.deepEqual([outputSettings(p).width,outputSettings(p).height],[2160,3840]);
for(const curve of ['constant','linear','ease-in','ease-out','ease-in-out'])for(const speed of [.05,.1,1,20]){const c=p.clips[0];Object.assign(c,{in:2,out:7,speed,endSpeed:.2,curve,hold:.8});const row=sequence(p)[0],end=timing(c).duration;for(let t=0;t<end;t+=end/51){assert.ok(Math.abs(sourceTime(row,t)-Math.min(c.out-1e-6,c.in+sourceOffset(t,c)))<1e-8)}}
assert.equal(gainAt(0,4,1,1,1),0);assert.equal(gainAt(2,4,.7,1,1),.7);assert.equal(gainAt(4,4,1,1,1),0);
const data=new Float32Array(8);mixWindow(data,0,4,[new Float32Array([0,1,0,-1,0]),new Float32Array([1,0,-1,0,1])],i=>i*.5,()=>.5);assert.deepEqual([...data],[0,.25,.5,.25,.5,.25,0,-.25]);
const aliased=new Float32Array(40),nyquist=Float32Array.from({length:64},(_,i)=>i%2?1:-1);mixWindow(aliased,0,20,[nyquist,nyquist],i=>8+i*2,()=>1);assert.ok(Math.max(...aliased.map(Math.abs))<.2);const hot=new Float32Array([2,.5,.25,0,2,.5,.25,0]);const state=limitStereo(hot);assert.ok(Math.max(...hot.map(Math.abs))<=.950001);assert.ok(state.gain<1);
let seed=101;const n=48,a=Float32Array.from({length:n*n},()=>{seed=(seed*1664525+1013904223)>>>0;return seed%255}),b=new Float32Array(n*n);for(let y=0;y<n-1;y++)for(let x=0;x<n-2;x++)b[(y+1)*n+x+2]=a[y*n+x];assert.deepEqual(translation(a,b),[2/n,1/n]);assert.deepEqual(translation(new Float32Array(n*n),new Float32Array(n*n)),[0,0]);
const moving=Array.from({length:30},(_,i)=>({time:i/12,x:i*.02+(i%2?.015:0),y:0})),path=smoothPath(moving,'NATURAL');assert.ok(path.scale>1&&path.scale<=1.21);assert.ok(Math.abs(correctionAt(path,1).x)<=.08);const before=moving.map((p,i)=>p.x-i*.02),after=moving.map((p,i)=>p.x+correctionAt(path,p.time).x-i*.02),energy=a=>a.reduce((s,v)=>s+v*v,0);assert.ok(energy(after)<energy(before)*.6);assert.equal(safeName('a/b:test','mp4'),'a_b_test.mp4');
console.log('Mobile: output sizes/FPS, all speed curves/holds, audio resampling/fades, motion translation/crop, filenames PASS');

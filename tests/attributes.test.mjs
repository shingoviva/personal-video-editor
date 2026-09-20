import assert from 'node:assert/strict';
import {pasteAttributes} from '../dist/attributes.js';

const source={id:'source',media:'a',kind:'video',in:1,out:8,start:2,layer:0,speed:.2,endSpeed:3,curve:'ease-in-out',timingBase:{in:0},scale:1.4,x:.2,y:.8,color:{exposure:.5},audio:{volume:.4,mute:true},opacity:.7,opacityKeyframes:[{time:0,value:0},{time:2,value:1}]};
const target={id:'target',media:'b',kind:'video',in:4,out:9,start:11,layer:2,speed:1,timingBase:{in:4},scale:1,x:.5,y:.5,color:{exposure:0},audio:{volume:1,mute:false},opacity:1};
assert.equal(pasteAttributes(target,source,['color','crop','motion','visual','audio']),true);
assert.deepEqual([target.id,target.media,target.in,target.out,target.start,target.layer],['target','b',4,9,11,2]);
assert.deepEqual([target.speed,target.endSpeed,target.curve,target.scale,target.x,target.y],[.2,3,'ease-in-out',1.4,.2,.8]);
assert.deepEqual(target.opacityKeyframes,source.opacityKeyframes);target.opacityKeyframes[0].value=.5;assert.equal(source.opacityKeyframes[0].value,0);
assert.equal(target.timingBase,undefined);target.color.exposure=2;target.audio.volume=2;assert.equal(source.color.exposure,.5);assert.equal(source.audio.volume,.4);
const audio={id:'audio',media:'c',kind:'audio',in:0,out:2,start:4,layer:3,audio:{volume:1,mute:false}};assert.equal(pasteAttributes(audio,source,['color','crop','motion','visual']),false);assert.equal(pasteAttributes(audio,source,['audio']),true);assert.deepEqual([audio.start,audio.layer,audio.audio.volume],[4,3,.4]);
console.log('Attributes: isolated category paste preserves media, cuts, position and layers PASS');

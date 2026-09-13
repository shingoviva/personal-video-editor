import assert from 'node:assert/strict';
import {centeredTransform,scaleFromWheel} from '../dist/stage-transform.js';
assert.deepEqual(centeredTransform({x:.45,y:.55},-5,5,100,100),{x:.5,y:.5,snapX:true,snapY:true});
assert.equal(scaleFromWheel(1,-100)>1,true);
assert.equal(scaleFromWheel(3,-100),3);
assert.equal(scaleFromWheel(1,100),1);
console.log('Stage transform: position, center snapping and scale limits PASS');

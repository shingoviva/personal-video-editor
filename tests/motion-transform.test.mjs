import assert from 'node:assert/strict';
import {motionTransform} from '../dist/motion-transform.js';

const base={x:.5,y:.5,scale:1,motionAmount:.2};
assert.deepEqual(motionTransform({...base,motionPreset:'none'},.5,1),{...base,motionPreset:'none'});
assert.equal(motionTransform({...base,motionPreset:'push-in'},1,1).scale,1.2);
assert.equal(motionTransform({...base,motionPreset:'pull-out'},1,1).scale,1);
assert.equal(motionTransform({...base,motionPreset:'pan-right'},1,1).x,.6);
assert.equal(motionTransform({...base,motionPreset:'pan-up'},1,1).y,.4);
assert.equal(motionTransform({...base,motionPreset:'pan-down'},1,1).y,.6);
console.log('Motion transform: video/image pan and push/pull interpolation PASS');

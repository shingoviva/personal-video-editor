import assert from 'node:assert/strict';
import {CURVE_IDENTITY,normalizeCurve,curveAt,curveColor} from '../dist/tone-curve.js';
import {colors,clip,project,sanitize} from '../dist/model.js';

assert.deepEqual(normalizeCurve(),CURVE_IDENTITY);
assert(Math.abs(curveAt([0,.1,.5,.9,1],.375)-.3)<1e-12);
assert.deepEqual(normalizeCurve([-2,.2,NaN,2]),[0,.2,.5,1,1]);
assert.deepEqual(curveColor({curveMaster:[0,.1,.4,.8,1]},0).curveMaster,CURVE_IDENTITY);
assert.deepEqual(curveColor({curveMaster:[0,.1,.4,.8,1]},1).curveMaster,[0,.1,.4,.8,1]);
const media={id:'m',kind:'video',duration:2},p=project();p.media=[media];p.clips=[clip(media)];delete p.clips[0].color.curveBlue;p.clips[0].color.curveMaster=[-.5,.2,.55,1.5];
const restored=sanitize(JSON.parse(JSON.stringify(p))).clips[0].color;
assert.deepEqual(restored.curveMaster,[0,.2,.55,1,1]);assert.deepEqual(restored.curveBlue,CURVE_IDENTITY);assert.equal(colors().brilliance,0);assert.equal(colors().noiseReduction,0);
console.log('Tone curve: interpolation, amount, clamping and project migration PASS');

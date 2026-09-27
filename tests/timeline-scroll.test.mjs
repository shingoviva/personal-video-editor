import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nearestLaneScroll,timelineLabelTransform} from '../dist/timeline-scroll.js';

const stops=[0,52,104,156,208,260,312,356,400,444];
assert.equal(nearestLaneScroll(0,stops),0);
assert.equal(nearestLaneScroll(25,stops),0);
assert.equal(nearestLaneScroll(27,stops),52);
assert.equal(nearestLaneScroll(80,stops),104);
assert.equal(nearestLaneScroll(999,stops),444);
assert.equal(nearestLaneScroll(30,[52,0,52,NaN]),52);
assert.equal(timelineLabelTransform(83.5),'translate3d(0,-83.5px,0)');
assert.equal(timelineLabelTransform(-10),'translate3d(0,-0px,0)');
const implementation=fs.readFileSync(new URL('../dist/timeline-scroll.js',import.meta.url),'utf8');
assert.doesNotMatch(implementation,/scroll\.scrollTop\s*=/,'vertical scrolling must never be rewritten or snapped');
console.log('Timeline vertical scroll: continuous labels without scroll snapping PASS');

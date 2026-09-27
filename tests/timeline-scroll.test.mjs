import assert from 'node:assert/strict';
import {nearestLaneScroll} from '../dist/timeline-scroll.js';

const stops=[0,52,104,156,208,260,312,356,400,444];
assert.equal(nearestLaneScroll(0,stops),0);
assert.equal(nearestLaneScroll(25,stops),0);
assert.equal(nearestLaneScroll(27,stops),52);
assert.equal(nearestLaneScroll(80,stops),104);
assert.equal(nearestLaneScroll(999,stops),444);
assert.equal(nearestLaneScroll(30,[52,0,52,NaN]),52);
console.log('Timeline vertical scroll: nearest complete lane boundary PASS');

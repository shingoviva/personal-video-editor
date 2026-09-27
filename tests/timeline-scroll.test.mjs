import assert from 'node:assert/strict';
import {nearestLaneScroll} from '../dist/timeline-scroll.js';

const stops=[0,32,64,96,148,200,252,296,340,384];
assert.equal(nearestLaneScroll(0,stops),0);
assert.equal(nearestLaneScroll(15,stops),0);
assert.equal(nearestLaneScroll(17,stops),32);
assert.equal(nearestLaneScroll(81,stops),96);
assert.equal(nearestLaneScroll(999,stops),384);
assert.equal(nearestLaneScroll(20,[32,0,32,NaN]),32);
console.log('Timeline vertical scroll: nearest complete lane boundary PASS');

import assert from 'node:assert/strict';
import {performanceModes,performanceMode,setPerformanceMode,previewFrameInterval,memorySnapshot,cancelIdleRelease} from '../dist/preview-performance.js';

assert.deepEqual(Object.keys(performanceModes),['eco','balanced','quality']);
setPerformanceMode('eco');assert.equal(performanceMode(),'eco');assert.equal(previewFrameInterval(),1000/24);
setPerformanceMode('quality');assert.equal(previewFrameInterval(),1000/60);
assert.equal(setPerformanceMode('invalid'),'quality');assert.equal(memorySnapshot().mode,'quality');cancelIdleRelease();
console.log('Preview performance: selectable FPS budget and safe memory snapshot PASS');

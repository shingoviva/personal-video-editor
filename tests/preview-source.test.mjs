import assert from 'node:assert/strict';
import {textureRevision} from '../dist/preview.js';

assert.equal(textureRevision({width:1920,height:1080}),null,'mutable canvases must upload on every draw');
const video={readyState:4,currentTime:0,getVideoPlaybackQuality:()=>({totalVideoFrames:1})};
const first=textureRevision(video);video.currentTime=1/30;video.getVideoPlaybackQuality=()=>({totalVideoFrames:2});
assert.notEqual(textureRevision(video),first,'video frame changes must invalidate the texture');
assert.equal(textureRevision(video),textureRevision(video),'an unchanged media frame may remain cached');
console.log('Preview source: mutable export canvases refresh every frame PASS');

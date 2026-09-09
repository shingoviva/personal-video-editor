import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';
import {Input,ALL_FORMATS,BlobSource} from '../dist/vendor/mediabunny.mjs';
import {project,clip,visibleSequence} from '../dist/model.js';
globalThis.onmessage=null;const {mixAudio}=await import('../dist/mobile-render-worker.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pve-four-voices-')),inputs=[];
try{
 const p=project(),resources=new Map();p.clips=[{gap:2}];
 for(let k=0;k<4;k++){const file=path.join(tmp,k+'.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`sine=frequency=${440+k*220}:sample_rate=48000:duration=1`,'-c:a','pcm_s16le',file]);const input=new Input({formats:ALL_FORMATS,source:new BlobSource(await fs.openAsBlob(file))});inputs.push(input);const m={id:String(k),kind:'audio',duration:1,audio:true};p.media.push(m);p.audioClips.push({...clip(m),kind:'audio',start:0,layer:k,out:2,loop:true,audio:{volume:.4,mute:false}});resources.set(m.id,{audio:await input.getPrimaryAudioTrack(),duration:1});}
 async function energy(){const sample=await mixAudio(visibleSequence(p),resources,p,.9,1.15);try{const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{planeIndex:0,format:'f32-planar'});return [440,660,880,1100].map(f=>{let re=0,im=0;for(let i=0;i<data.length;i++){re+=data[i]*Math.cos(2*Math.PI*f*i/48000);im+=data[i]*Math.sin(2*Math.PI*f*i/48000)}return 2*Math.hypot(re,im)/data.length})}finally{sample.close()}}
 let e=await energy();assert(Math.min(...e)>.03,e);p.audioTracks[1].solo=true;e=await energy();assert(e[1]>.03&&Math.max(e[0],e[2],e[3])<.001,e);p.audioTracks[1].mute=true;e=await energy();assert(Math.max(...e)===0,e);
 console.log('Device mixer: 4 actual PCM voices, loop boundary, solo and mute PASS');
}finally{for(const input of inputs)input.dispose();fs.rmSync(tmp,{recursive:true,force:true})}

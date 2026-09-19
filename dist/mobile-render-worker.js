import {audioWindows,trackGain} from './audio-timeline.js';
import {Input,ALL_FORMATS,BlobSource,CanvasSink,AudioSampleSink,VideoSampleSink,Output,Mp4OutputFormat,StreamTarget,CanvasSource,AudioSampleSource,AudioSample,Quality,canEncodeVideo,canEncodeAudio} from './vendor/mediabunny.mjs';
import {clipAlpha,effectAlpha} from './creative.js';
import {imageBitmap} from './image-media.js';
import {renderer} from './preview.js';
import {sequence,visibleSequence,timing,sourceOffset} from './model.js';
import {outputSettings,sourceTime,gainAt,held,mixWindow,limitStereo} from './mobile-model.js';
import {translation,smoothPath,correctionAt} from './mobile-stabilize.js';
import {drawTextCanvas} from './text-render.js';
import {motionTransform} from './motion-transform.js';
import {frameAtTimestamp} from './frame-source.js';
let cancelled=false,limiter={gain:1};
const check=()=>{if(cancelled)throw new DOMException('書き出しを中止しました。','AbortError')};
const progress=(operation,value)=>postMessage({type:'progress',operation,value});
const open=file=>new Input({formats:ALL_FORMATS,source:new BlobSource(file)});
const canvas=(w,h)=>new OffscreenCanvas(w,h);
export async function audioRange(track,start,end){
 const rate=track.sampleRate,length=Math.ceil((end-start)*rate)+2;if(length>rate*6)throw Error('音声処理の区間が長すぎます。');const planes=[new Float32Array(length),new Float32Array(length)];
 const sink=new AudioSampleSink(track);for await(const sample of sink.samples(Math.max(0,start),end)){try{check();const offset=Math.round((sample.timestamp-start)*rate);for(let ch=0;ch<2;ch++){const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{planeIndex:Math.min(ch,sample.numberOfChannels-1),format:'f32-planar'});const a=Math.max(0,-offset),b=Math.min(data.length,length-offset);if(b>a)planes[ch].set(data.subarray(a,b),offset+a)}}finally{sample.close()}}
 return{planes,rate,start};
}
export async function mixAudio(rows,resources,p,start,end){
 const rate=48000,n=Math.round((end-start)*rate),data=new Float32Array(n*2);if(!n)return null;
 for(const row of [...rows,...audioWindows(p)]){const c=row.clip;if(c.kind!=='audio'&&(p.audioTracks||[]).some(t=>t.solo))continue;if(c.gap||c.freezeDuration||c.audio.mute||!c.audio.volume)continue;const track=resources.get(c.media).audio;if(!track)continue;const a=Math.max(start,row.start),b=Math.min(end,row.end,row.start+timing(c).nodes.at(-1)[1]-(row.offset||0));if(b<=a)continue;
 const lo=Math.max(0,Math.round((a-start)*rate)),hi=Math.min(n,Math.round((b-start)*rate));const from=sourceTime(row,a),to=sourceTime(row,b),res=resources.get(c.media),trackVolume=c.kind==='audio'?trackGain(p,row.layer):1;if(!trackVolume)continue;
 const ranges=[];if(!c.loop)ranges.push([from,to+.002]);else{const d=res.duration,span=to-from,f=from%d;if(span>=d)ranges.push([0,d]);else{ranges.push([f,Math.min(d,f+span+.002)]);if(f+span>d)ranges.push([0,f+span-d+.002])}}
 for(const [begin,stop] of ranges){const chunk=await audioRange(track,begin,stop);mixWindow(data,lo,hi-lo,chunk.planes,i=>{const s=sourceTime(row,start+(lo+i)/rate),pos=c.loop?s%res.duration:s;return pos>=begin&&pos<stop?(pos-begin)*chunk.rate:-1},i=>trackVolume*gainAt(start+(lo+i)/rate-row.start+(row.offset||0),row.originalDuration??row.duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut));}
 }
 const bg=resources.get(p.bgm.media);if(bg?.audio&&p.bgm.volume){let cursor=start;while(cursor<end-1e-8){check();const local=cursor%bg.duration,stop=Math.min(end,cursor+bg.duration-local);if(stop<=cursor)break;const chunk=await audioRange(bg.audio,local,local+stop-cursor+.002),lo=Math.max(0,Math.round((cursor-start)*rate)),hi=Math.min(n,Math.round((stop-start)*rate));mixWindow(data,lo,hi-lo,chunk.planes,i=>i*chunk.rate/rate,i=>gainAt(start+(lo+i)/rate,rows.at(-1).end,p.bgm.volume,p.bgm.fadeIn,p.bgm.fadeOut));cursor=stop;}}
 limitStereo(data,limiter,rate);return new AudioSample({data,format:'f32-planar',numberOfChannels:2,sampleRate:rate,timestamp:start});
}
async function stabilize(track,c,onProgress){
 const sink=new CanvasSink(track,{width:48,height:48,fit:'fill',poolSize:1});let last=null,x=0,y=0;const points=[];const count=Math.min(18000,Math.max(1,Math.ceil((c.out-c.in)*12)));function* stamps(){for(let i=0;i<count;i++)yield c.in+i*(c.out-c.in)/count}
 for await(const frame of sink.canvasesAtTimestamps(stamps())){check();if(!frame)continue;const pixels=frame.canvas.getContext('2d').getImageData(0,0,48,48).data,gray=new Float32Array(48*48);for(let i=0;i<gray.length;i++)gray[i]=.299*pixels[4*i]+.587*pixels[4*i+1]+.114*pixels[4*i+2];if(last){const [dx,dy]=translation(last,gray);x+=dx;y+=dy}points.push({time:frame.timestamp,x,y});last=gray;if(points.length%24===0)onProgress(points.length/count);}
 return smoothPath(points,c.stabilization);
}
async function frameReader(row,res,cfg,start=row.start){
 const c=row.clip;let still,pathData,blend,stable;const frameState={frame:null,source:-1};
 try{
 if(res.imageFile){still=await imageBitmap(res.imageFile,res.metadata,Math.min(8192,Math.max(cfg.width,cfg.height)*(c.scale||1)));return{frame:async()=>still,close:async()=>still.close()}}
 if(!res.video)throw Error('映像トラックがありません。');
 if(c.stabilization!=='OFF'&&!c.freezeDuration){progress('手ぶれの動きを解析中',0);pathData=await stabilize(res.video,c,()=>{});}
 const scale=Math.min(1,Math.max(cfg.width/res.video.displayWidth,cfg.height/res.video.displayHeight)*(c.scale||1)*(pathData?.scale||1));
 const sw=Math.max(2,Math.round(res.video.displayWidth*scale)),sh=Math.max(2,Math.round(res.video.displayHeight*scale)),sink=new CanvasSink(res.video,{width:sw,height:sh,fit:'fill',poolSize:3});
 blend=canvas(sw,sh);const bc=blend.getContext('2d',{alpha:false});if(pathData)stable=canvas(sw,sh);
 return{async frame(t){
 const source=sourceTime(row,t);
 // CanvasSink recycles iterator canvases. Keeping one of those canvases across
 // encoder awaits can therefore repeat the same picture. A timestamp lookup
 // gives each output timestamp the correct decoded VFR frame before painting.
 const current=await frameAtTimestamp(sink,source,frameState);
 if(!current)throw Error('映像フレームを読み込めません。');
 bc.globalAlpha=1;bc.drawImage(current.canvas,0,0);
 if(c.interpolation==='blend'&&!c.freezeDuration){const following=await sink.getCanvas(Math.min(c.out-1e-7,source+1/cfg.fps));if(following&&following.timestamp>current.timestamp){bc.globalAlpha=Math.max(0,Math.min(1,(source-current.timestamp)/(following.timestamp-current.timestamp)));bc.drawImage(following.canvas,0,0);bc.globalAlpha=1}}
 if(stable){const sc=stable.getContext('2d',{alpha:false}),corr=correctionAt(pathData,source);sc.save();sc.fillStyle='#000';sc.fillRect(0,0,sw,sh);sc.translate(sw/2+corr.x*sw,sh/2+corr.y*sh);sc.scale(pathData.scale,pathData.scale);sc.drawImage(blend,-sw/2,-sh/2);sc.restore()}
 return stable||blend;
 },async close(){blend.width=blend.height=1;if(stable)stable.width=stable.height=1}};
 }catch(e){still?.close();throw e}
}
async function render(p,files,preview,outputPath){limiter={gain:1};
 const cfg=outputSettings(p,preview),hidden=layer=>!!p.videoTracks?.[layer]?.hidden,videoProject={...p,clips:p.clips.filter(c=>!hidden(c.layer||0)),audioClips:[]},rows=visibleSequence(videoProject),resources=new Map();let output,handle,fileHandle,root,path,success=false;const activeInputs=[],sessions=[null,null,null];let painter;
 try{
 if(!globalThis.VideoEncoder||!globalThis.AudioEncoder||!globalThis.OffscreenCanvas)throw Error('このブラウザは端末内書き出しに未対応です。最新のiOSのSafariで開いてください。');
 if(!await canEncodeVideo('avc',{width:cfg.width,height:cfg.height,bitrate:cfg.bitrate})||!await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2}))throw Error('選択したH.264/AAC設定に端末が対応していません。1080p・30fpsをお試しください。');
 const needed=new Set([...videoProject.clips,...p.audioClips||[]].filter(c=>!c.gap).map(c=>c.media));if(p.bgm.media)needed.add(p.bgm.media);
 for(const id of needed){check();const file=files.find(x=>x.id===id)?.file;if(!file)throw Error('元素材を再リンクしてください。');const metadata=p.media.find(m=>m.id===id);if(metadata?.kind==='image'){resources.set(id,{imageFile:file,metadata,audio:null,duration:5});continue}const input=open(file);activeInputs.push(input);const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();if(video&&p.clips.some(c=>c.media===id)){if(!await video.canDecode())throw Error(file.name+' の映像を端末でデコードできません。');const color=await video.getColorSpace();if(await video.hasHighDynamicRange()||['smpte2084','arib-std-b67'].includes(color.transfer))throw Error(file.name+' はHDRです。端末版の正確なトーンマッピングは未対応のため停止しました。SDR素材、またはMac版をご利用ください。');}
 const needsAudio=(p.audioClips||[]).some(c=>c.media===id)||id===p.bgm.media||rows.some(r=>r.clip.media===id&&!r.clip.audio?.mute&&r.clip.audio?.volume);if(audio&&needsAudio&&audio.numberOfChannels>2)throw Error('端末版の音声はモノラル・ステレオのみ対応しています。');if(audio&&needsAudio&&!await audio.canDecode())throw Error(file.name+' の音声をデコードできません。');resources.set(id,{input,video,audio:needsAudio?audio:null,duration:await input.computeDuration()});}
 check();const estimate=await navigator.storage.estimate();const expectedBytes=(cfg.bitrate+cfg.audioBitrate)*cfg.duration/8;if(estimate.quota&&estimate.quota-estimate.usage<expectedBytes*1.2)throw Error('書き出し用の空き容量が不足しています。画質か解像度を下げてください。');root=await navigator.storage.getDirectory();root=await root.getDirectoryHandle('pve-renders',{create:true});path=outputPath;fileHandle=await root.getFileHandle(path,{create:true});handle=await fileHandle.createSyncAccessHandle();
 const stream=new WritableStream({write({data,position}){check();if(handle.write(data,{at:position})!==data.byteLength)throw Error('端末の空き容量が不足しています。');}});
 output=new Output({format:new Mp4OutputFormat({fastStart:'reserve'}),target:new StreamTarget(stream,{chunked:true,chunkSize:1024*1024})});
 const picture=canvas(cfg.width,cfg.height),processed=canvas(cfg.width,cfg.height),ctx=picture.getContext('2d',{alpha:false});painter=renderer(processed,{width:cfg.width,height:cfg.height,preserve:true});if(!painter)throw Error('映像処理用GPUを利用できません。');
 const videoSource=new CanvasSource(picture,{codec:'avc',quality:new Quality({bitrate:cfg.bitrate}),keyFrameInterval:2});const audioSource=new AudioSampleSource({codec:'aac',quality:new Quality({bitrate:cfg.audioBitrate})});output.addVideoTrack(videoSource,{frameRate:cfg.fps,maximumPacketCount:cfg.frames+8});output.addAudioTrack(audioSource,{maximumPacketCount:Math.ceil(cfg.duration*48000/1024)+100});await output.start();let frameIndex=0,audioTime=0;
 const layerRows=[0,1,2].map(layer=>visibleSequence({...videoProject,clips:sequence(videoProject).filter(r=>r.layer===layer).map(r=>({...r.clip,start:r.start}))})),indices=[0,0,0];
 while(frameIndex<cfg.frames){
 check();const t=frameIndex/cfg.fps;ctx.globalAlpha=1;ctx.fillStyle='#000';ctx.fillRect(0,0,cfg.width,cfg.height);
 const active=layerRows.map((list,k)=>{while(indices[k]<list.length&&list[indices[k]].end<=t+1e-8)indices[k]++;const r=list[indices[k]];return r&&r.start<=t&&!r.clip.gap?r:null});
 for(let k=0;k<3;k++){
 const row=active[k],alpha=clipAlpha(row,t),occluded=active.some((r,j)=>j>k&&clipAlpha(r,t)>=1);
 if(!row||occluded){if(sessions[k]){await sessions[k].reader.close();sessions[k]=null}continue}
 if(sessions[k]?.row!==row){if(sessions[k])await sessions[k].reader.close();sessions[k]={row,reader:await frameReader(row,resources.get(row.clip.media),cfg,t)}}
 const frame=await sessions[k].reader.frame(t);painter.draw(frame,motionTransform(row.clip,t-row.start,row.duration),`${cfg.width}:${cfg.height}`);ctx.globalAlpha=alpha;ctx.drawImage(processed,0,0);ctx.globalAlpha=1;
 }
 for(const e of p.effects||[]){const alpha=effectAlpha(e,t);if(alpha){ctx.globalAlpha=alpha;ctx.fillStyle=e.type==='flash'?'#fff':'#000';ctx.fillRect(0,0,cfg.width,cfg.height)}}ctx.globalAlpha=1;
 for(const text of p.texts)drawTextCanvas(ctx,text,t,cfg.width,cfg.height);await videoSource.add(t,Math.min(1/cfg.fps,cfg.duration-t));frameIndex++;
 const target=Math.min(cfg.duration,frameIndex/cfg.fps);while(audioTime<target-1e-8){const end=Math.min(cfg.duration,audioTime+.25),sample=await mixAudio(rows,resources,p,audioTime,end);if(sample){try{await audioSource.add(sample)}finally{sample.close()}}audioTime=end;}
 if(frameIndex%5===0)progress('MP4を書き出し中',frameIndex/cfg.frames*.95);
 }
 check();progress('MP4を確定中',.96);await output.finalize();handle.flush();handle.close();handle=null;const file=await fileHandle.getFile();const verify=open(file);try{const v=await verify.getPrimaryVideoTrack(),a=await verify.getPrimaryAudioTrack(),duration=await verify.computeDuration();if(v?.codec!=='avc'||a?.codec!=='aac'||Math.abs(duration-cfg.duration)>Math.max(.15,2/cfg.fps))throw Error('生成した動画の検証に失敗しました。');let count=0;for await(const sample of new VideoSampleSink(v).samples()){try{check();count++;if(count%30===0)progress('完成動画を検証中',.96+.025*count/cfg.frames)}finally{sample.close()}}if(count!==cfg.frames)throw Error('完成動画のフレーム数が一致しません。');let audioPackets=0;for await(const sample of new AudioSampleSink(a).samples()){sample.close();check();if(++audioPackets%200===0)progress('完成音声を検証中',.99);}}finally{verify.dispose()}
 check();success=true;return{file,path,verified:true,...cfg};
 }finally{for(const session of sessions)await session?.reader.close();if(output&&output.state!=='finalized')await output.cancel().catch(()=>{});handle?.close();if(!success&&root&&path)await root.removeEntry(path).catch(()=>{});painter?.dispose();for(const input of activeInputs)input.dispose();}
}
onmessage=async({data})=>{if(data.type==='cancel'){cancelled=true;return}if(data.type!=='render')return;cancelled=false;try{const result=await render(data.project,data.files,data.preview,data.outputPath);postMessage({type:'done',result})}catch(e){postMessage({type:'error',error:e.message,cancelled:cancelled||e.name==='AbortError'})}};

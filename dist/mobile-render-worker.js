import {Input,ALL_FORMATS,BlobSource,CanvasSink,AudioSampleSink,VideoSampleSink,Output,Mp4OutputFormat,StreamTarget,CanvasSource,AudioSampleSource,AudioSample,Quality,canEncodeVideo,canEncodeAudio} from './vendor/mediabunny.mjs';
import {renderer} from './preview.js';
import {sequence,visibleSequence,timing,sourceOffset} from './model.js';
import {outputSettings,sourceTime,gainAt,held,mixWindow} from './mobile-model.js';
import {translation,smoothPath,correctionAt} from './mobile-stabilize.js';
let cancelled=false;
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
 for(const row of rows){const c=row.clip;if(c.gap||c.audio.mute||!c.audio.volume)continue;const track=resources.get(c.media).audio;if(!track)continue;const a=Math.max(start,row.start),b=Math.min(end,row.end,row.start+timing(c).nodes.at(-1)[1]-(row.offset||0));if(b<=a)continue;
 const lo=Math.max(0,Math.round((a-start)*rate)),hi=Math.min(n,Math.round((b-start)*rate));const from=sourceTime(row,a),to=sourceTime(row,b);const chunk=await audioRange(track,from,to+.002);
 mixWindow(data,lo,hi-lo,chunk.planes,i=>(sourceTime(row,start+(lo+i)/rate)-from)*chunk.rate,i=>gainAt(start+(lo+i)/rate-row.start+(row.offset||0),row.originalDuration??row.duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut));
 }
 const bg=resources.get(p.bgm.media);if(bg?.audio&&p.bgm.volume){let cursor=start;while(cursor<end-1e-8){check();const local=cursor%bg.duration,stop=Math.min(end,cursor+bg.duration-local);if(stop<=cursor)break;const chunk=await audioRange(bg.audio,local,local+stop-cursor+.002),lo=Math.max(0,Math.round((cursor-start)*rate)),hi=Math.min(n,Math.round((stop-start)*rate));mixWindow(data,lo,hi-lo,chunk.planes,i=>i*chunk.rate/rate,i=>gainAt(start+(lo+i)/rate,rows.at(-1).end,p.bgm.volume,p.bgm.fadeIn,p.bgm.fadeOut));cursor=stop;}}
 for(let i=0;i<data.length;i++)data[i]=Math.max(-1,Math.min(1,data[i]));return new AudioSample({data,format:'f32-planar',numberOfChannels:2,sampleRate:rate,timestamp:start});
}
async function stabilize(track,c,onProgress){
 const sink=new CanvasSink(track,{width:48,height:48,fit:'fill',poolSize:1});let last=null,x=0,y=0;const points=[];const count=Math.min(18000,Math.max(1,Math.ceil((c.out-c.in)*12)));function* stamps(){for(let i=0;i<count;i++)yield c.in+i*(c.out-c.in)/count}
 for await(const frame of sink.canvasesAtTimestamps(stamps())){check();if(!frame)continue;const pixels=frame.canvas.getContext('2d').getImageData(0,0,48,48).data,gray=new Float32Array(48*48);for(let i=0;i<gray.length;i++)gray[i]=.299*pixels[4*i]+.587*pixels[4*i+1]+.114*pixels[4*i+2];if(last){const [dx,dy]=translation(last,gray);x+=dx;y+=dy}points.push({time:frame.timestamp,x,y});last=gray;if(points.length%24===0)onProgress(points.length/count);}
 return smoothPath(points,c.stabilization);
}
function drawText(ctx,p,t,w,h){for(const text of p.texts){if(t<text.start||t>text.end)continue;const fade=text.fade?Math.max(0,Math.min(1,(t-text.start)/text.fade,(text.end-t)/text.fade)):1;ctx.save();ctx.fillStyle='#fff';ctx.globalAlpha=text.opacity*fade;const size=text.size*h/1080;ctx.font=`${size}px ${text.font==='Serif'?'Georgia':text.font==='Mono'?'monospace':'Arial'}`;ctx.textAlign=text.align||'center';ctx.textBaseline='middle';const lines=text.text.split('\n');lines.forEach((line,i)=>ctx.fillText(line,text.x*w,text.y*h+(i-(lines.length-1)/2)*size*1.1,w*.96));ctx.restore();}}
async function render(p,files,preview,outputPath){
 const cfg=outputSettings(p,preview),rows=visibleSequence(p),resources=new Map();let output,handle,fileHandle,root,path,success=false;const activeInputs=[];let painter;
 try{
 if(!globalThis.VideoEncoder||!globalThis.AudioEncoder||!globalThis.OffscreenCanvas)throw Error('このブラウザは端末内書き出しに未対応です。最新のiOSのSafariで開いてください。');
 if(!await canEncodeVideo('avc',{width:cfg.width,height:cfg.height,bitrate:cfg.bitrate})||!await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2}))throw Error('選択したH.264/AAC設定に端末が対応していません。1080p・30fpsをお試しください。');
 const needed=new Set(rows.filter(r=>!r.clip.gap).map(r=>r.clip.media));if(p.bgm.media)needed.add(p.bgm.media);
 for(const id of needed){check();const file=files.find(x=>x.id===id)?.file;if(!file)throw Error('元素材を再リンクしてください。');const input=open(file);activeInputs.push(input);const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();if(video){if(!await video.canDecode())throw Error(file.name+' の映像を端末でデコードできません。');const color=await video.getColorSpace();if(await video.hasHighDynamicRange()||['smpte2084','arib-std-b67'].includes(color.transfer))throw Error(file.name+' はHDRです。端末版の正確なトーンマッピングは未対応のため停止しました。SDR素材、またはMac版をご利用ください。');}
 const needsAudio=id===p.bgm.media||rows.some(r=>r.clip.media===id&&!r.clip.audio?.mute&&r.clip.audio?.volume);if(audio&&needsAudio&&audio.numberOfChannels>2)throw Error('端末版の音声はモノラル・ステレオのみ対応しています。');if(audio&&needsAudio&&!await audio.canDecode())throw Error(file.name+' の音声をデコードできません。');resources.set(id,{input,video,audio:needsAudio?audio:null,duration:await input.computeDuration()});}
 check();const estimate=await navigator.storage.estimate();const expectedBytes=(cfg.bitrate+192000)*cfg.duration/8;if(estimate.quota&&estimate.quota-estimate.usage<expectedBytes*1.2)throw Error('書き出し用の空き容量が不足しています。画質か解像度を下げてください。');root=await navigator.storage.getDirectory();root=await root.getDirectoryHandle('pve-renders',{create:true});path=outputPath;fileHandle=await root.getFileHandle(path,{create:true});handle=await fileHandle.createSyncAccessHandle();
 const stream=new WritableStream({write({data,position}){check();if(handle.write(data,{at:position})!==data.byteLength)throw Error('端末の空き容量が不足しています。');}});
 output=new Output({format:new Mp4OutputFormat({fastStart:'reserve'}),target:new StreamTarget(stream,{chunked:true,chunkSize:1024*1024})});
 const picture=canvas(cfg.width,cfg.height),processed=canvas(cfg.width,cfg.height),ctx=picture.getContext('2d',{alpha:false});painter=renderer(processed,{width:cfg.width,height:cfg.height,preserve:true});if(!painter)throw Error('映像処理用GPUを利用できません。');
 const videoSource=new CanvasSource(picture,{codec:'avc',quality:new Quality({bitrate:cfg.bitrate}),keyFrameInterval:2});const audioSource=new AudioSampleSource({codec:'aac',quality:new Quality({bitrate:192000})});output.addVideoTrack(videoSource,{frameRate:cfg.fps,maximumPacketCount:cfg.frames+8});output.addAudioTrack(audioSource,{maximumPacketCount:Math.ceil(cfg.duration*48000/1024)+100});await output.start();let frameIndex=0,audioTime=0;
 for(const row of rows){check();const c=row.clip,res=resources.get(c.media);let iterator,current,next,pathData,sink;let blendCanvas,blendCtx,stableCanvas,stableCtx;
 try{
 if(!c.gap){if(!res?.video)throw Error('映像トラックがありません。');if(c.stabilization!=='OFF'){progress('手ぶれの動きを解析中',frameIndex/cfg.frames*.9);pathData=await stabilize(res.video,c,value=>progress('手ぶれの動きを解析中 '+Math.round(value*100)+'%',frameIndex/cfg.frames*.9));postMessage({type:'note',text:'端末版の平行移動補正・クロップ '+(pathData.crop*100).toFixed(1)+'%'});}
 const aspect=res.video.displayWidth/res.video.displayHeight;const scale=Math.min(1,Math.max(cfg.width/res.video.displayWidth,cfg.height/res.video.displayHeight)*(c.scale||1)*(pathData?.scale||1));const sw=Math.max(2,Math.round(res.video.displayWidth*scale)),sh=Math.max(2,Math.round(res.video.displayHeight*scale));
 sink=new CanvasSink(res.video,{width:sw,height:sh,fit:'fill',poolSize:3});current=await sink.getCanvas(sourceTime(row,row.start));iterator=sink.canvases(Math.max(0,sourceTime(row,row.start)-.1),c.out)[Symbol.asyncIterator]();next=await iterator.next();blendCanvas=canvas(sw,sh);blendCtx=blendCanvas.getContext('2d',{alpha:false});if(pathData){stableCanvas=canvas(sw,sh);stableCtx=stableCanvas.getContext('2d',{alpha:false})}}
 while(frameIndex<cfg.frames&&frameIndex/cfg.fps<row.end-1e-8){check();const t=frameIndex/cfg.fps;ctx.fillStyle='#000';ctx.fillRect(0,0,cfg.width,cfg.height);
 if(!c.gap){const source=sourceTime(row,t);while(!next.done&&next.value.timestamp<=source+1e-8){current=next.value;next=await iterator.next()}if(!current)current=next.value;if(!current)throw Error('映像フレームを読み込めません。');blendCtx.globalAlpha=1;blendCtx.drawImage(current.canvas,0,0);if(c.interpolation==='blend'&&!next.done&&next.value.timestamp>current.timestamp){blendCtx.globalAlpha=Math.max(0,Math.min(1,(source-current.timestamp)/(next.value.timestamp-current.timestamp)));blendCtx.drawImage(next.value.canvas,0,0);blendCtx.globalAlpha=1;}
 if(pathData){const corr=correctionAt(pathData,source),w=stableCanvas.width,h=stableCanvas.height;stableCtx.save();stableCtx.fillStyle='#000';stableCtx.fillRect(0,0,w,h);stableCtx.translate(w/2+corr.x*w,h/2+corr.y*h);stableCtx.scale(pathData.scale,pathData.scale);stableCtx.drawImage(blendCanvas,-w/2,-h/2);stableCtx.restore();}painter.draw(stableCanvas||blendCanvas,c,p.aspect);ctx.drawImage(processed,0,0);}
 drawText(ctx,p,t,cfg.width,cfg.height);await videoSource.add(t,Math.min(1/cfg.fps,cfg.duration-t));frameIndex++;
 const target=Math.min(cfg.duration,frameIndex/cfg.fps);while(audioTime<target-1e-8){const end=Math.min(cfg.duration,audioTime+.25);const sample=await mixAudio(rows,resources,p,audioTime,end);if(sample){try{await audioSource.add(sample)}finally{sample.close()}}audioTime=end;}
 if(frameIndex%5===0)progress('MP4を書き出し中',frameIndex/cfg.frames*.95);
 }
 }finally{await iterator?.return?.();if(blendCanvas){blendCanvas.width=blendCanvas.height=1;}if(stableCanvas){stableCanvas.width=stableCanvas.height=1;}}}
 check();progress('MP4を確定中',.96);await output.finalize();handle.flush();handle.close();handle=null;const file=await fileHandle.getFile();const verify=open(file);try{const v=await verify.getPrimaryVideoTrack(),a=await verify.getPrimaryAudioTrack(),duration=await verify.computeDuration();if(v?.codec!=='avc'||a?.codec!=='aac'||Math.abs(duration-cfg.duration)>Math.max(.15,2/cfg.fps))throw Error('生成した動画の検証に失敗しました。');let count=0;for await(const sample of new VideoSampleSink(v).samples()){try{check();count++;if(count%30===0)progress('完成動画を検証中',.96+.025*count/cfg.frames)}finally{sample.close()}}if(count!==cfg.frames)throw Error('完成動画のフレーム数が一致しません。');let audioPackets=0;for await(const sample of new AudioSampleSink(a).samples()){sample.close();check();if(++audioPackets%200===0)progress('完成音声を検証中',.99);}}finally{verify.dispose()}
 check();success=true;return{file,path,verified:true,...cfg};
 }finally{if(output&&output.state!=='finalized')await output.cancel().catch(()=>{});handle?.close();if(!success&&root&&path)await root.removeEntry(path).catch(()=>{});painter?.dispose();for(const input of activeInputs)input.dispose();}
}
onmessage=async({data})=>{if(data.type==='cancel'){cancelled=true;return}if(data.type!=='render')return;cancelled=false;try{const result=await render(data.project,data.files,data.preview,data.outputPath);postMessage({type:'done',result})}catch(e){postMessage({type:'error',error:e.message,cancelled:cancelled||e.name==='AbortError'})}};

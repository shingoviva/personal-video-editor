import {sequence,total,timing,sourceOffset,clamp} from './model.js';
export function outputSettings(p,preview=false){
 const m=p.media.find(m=>m.id===p.clips.find(c=>!c.gap)?.media)||{width:1920,height:1080,fps:30};
 const ar=p.aspect==='Original'?m.width/m.height:p.aspect.split(':').map(Number).reduce((a,b)=>a/b);
 const edge=preview?540:p.export.resolution==='4K'?2160:p.export.resolution==='1440p'?1440:p.export.resolution==='Source'?Math.min(m.width,m.height):1080;
 const width=2*Math.max(1,Math.round((ar>=1?edge*ar:edge)/2)),height=2*Math.max(1,Math.round((ar>=1?edge:edge/ar)/2));
 const fps=p.export.fps==='Source'?clamp(m.fps||30,1,60):clamp(p.export.fps||30,1,60);
 const duration=total(p);if(!Number.isFinite(duration)||duration<=0)throw Error('書き出し時間が無効です。');
 const youtube=p.export.preset==='YOUTUBE',automaticAudio=youtube&&['High','Maximum'].includes(p.export.quality)?320000:192000;
 const requestedVideo=Number(p.export.videoBitrate),requestedAudio=Number(p.export.audioBitrate);
 const bitrate=requestedVideo>0?Math.round(clamp(requestedVideo,1,200)*1e6):Math.round(width*height*fps*({Preview:.05,Standard:.09,High:.14,Maximum:.22}[p.export.quality]||.14));
 const audioBitrate=requestedAudio>0?Math.round(clamp(requestedAudio,96,320)*1000):automaticAudio;
 return {width,height,fps,duration,frames:Math.ceil(duration*fps),bitrate,audioBitrate};
}
export function sourceTime(row,t){const c=row.clip;if(c.freezeDuration)return c.freezeAt??c.in;const nodes=(row._timing??=timing(c)).nodes;const dt=Math.max(0,t-row.start+(row.offset||0));for(let i=1;i<nodes.length;i++){const [x0,y0]=nodes[i-1],[x1,y1]=nodes[i];if(dt<=y1)return Math.min(c.out-1e-6,c.in+x0+(dt-y0)*(x1-x0)/(y1-y0));}return c.out-1e-6;}
export function gainAt(t,duration,volume=1,fadeIn=0,fadeOut=0){return Math.max(0,volume)*Math.max(0,Math.min(1,fadeIn?t/fadeIn:1,fadeOut?(duration-t)/fadeOut:1));}
export function held(row,t){return !!row.clip.freezeDuration||t-row.start+(row.offset||0)>=timing(row.clip).nodes.at(-1)[1];}
// Stereo resampling. Fast playback uses a short windowed-sinc low-pass filter
// to suppress fold-back aliasing; ordinary playback keeps the cheaper linear path.
export function mixWindow(dst,offset,count,source,positions,gains){
 const n=dst.length/2;let previous=-1;for(let i=0;i<count;i++){const pos=positions(i),j=Math.floor(pos),f=pos-j;if(j<0||j>=source[0].length)continue;const next=i+1<count?positions(i+1):previous>=0?pos+(pos-previous):pos,step=Math.abs(next-pos);previous=pos;for(let ch=0;ch<2;ch++){const a=source[ch]||source[0];let value;if(step>1.25){const cutoff=Math.min(1,1/step),radius=4;let sum=0,weight=0;for(let k=j-radius+1;k<=j+radius;k++){if(k<0||k>=a.length)continue;const d=pos-k,w=(d?Math.sin(Math.PI*d*cutoff)/(Math.PI*d):cutoff)*(.5+.5*Math.cos(Math.PI*d/radius));sum+=a[k]*w;weight+=w}value=weight?sum/weight:0}else value=a[j]+((a[j+1]??a[j])-a[j])*f;dst[ch*n+offset+i]+=value*gains(i);}}
}

export function limitStereo(data,state={gain:1},rate=48000){const n=data.length/2,release=1-Math.exp(-1/(.05*rate));for(let i=0;i<n;i++){const peak=Math.max(Math.abs(data[i]),Math.abs(data[n+i])),target=peak>.95?.95/peak:1;state.gain=target<state.gain?target:state.gain+(1-state.gain)*release;data[i]*=state.gain;data[n+i]*=state.gain}return state}

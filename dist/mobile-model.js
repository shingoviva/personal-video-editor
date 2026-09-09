import {sequence,total,timing,sourceOffset,clamp} from './model.js';
export function outputSettings(p,preview=false){
 const m=p.media.find(m=>m.id===p.clips.find(c=>!c.gap)?.media);if(!m)throw Error('動画を追加してください。');
 const ar=p.aspect==='Original'?m.width/m.height:p.aspect.split(':').map(Number).reduce((a,b)=>a/b);
 const edge=preview?540:p.export.resolution==='4K'?2160:p.export.resolution==='Source'?Math.min(m.width,m.height):1080;
 const width=2*Math.max(1,Math.round((ar>=1?edge*ar:edge)/2)),height=2*Math.max(1,Math.round((ar>=1?edge:edge/ar)/2));
 const fps=p.export.fps==='Source'?clamp(m.fps||30,1,60):clamp(p.export.fps||30,1,60);
 const duration=total(p);if(!Number.isFinite(duration)||duration<=0)throw Error('書き出し時間が無効です。');
 return {width,height,fps,duration,frames:Math.ceil(duration*fps),bitrate:Math.round(width*height*fps*({Preview:.05,Standard:.09,High:.14,Maximum:.22}[p.export.quality]||.14))};
}
export function sourceTime(row,t){const c=row.clip;if(c.freezeDuration)return c.freezeAt??c.in;const nodes=(row._timing??=timing(c)).nodes;const dt=Math.max(0,t-row.start+(row.offset||0));for(let i=1;i<nodes.length;i++){const [x0,y0]=nodes[i-1],[x1,y1]=nodes[i];if(dt<=y1)return Math.min(c.out-1e-6,c.in+x0+(dt-y0)*(x1-x0)/(y1-y0));}return c.out-1e-6;}
export function gainAt(t,duration,volume=1,fadeIn=0,fadeOut=0){return Math.max(0,volume)*Math.max(0,Math.min(1,fadeIn?t/fadeIn:1,fadeOut?(duration-t)/fadeOut:1));}
export function held(row,t){return !!row.clip.freezeDuration||t-row.start+(row.offset||0)>=timing(row.clip).nodes.at(-1)[1];}
// Stereo, linear resampling. Speed affects original-audio pitch; BGM keeps its rate.
export function mixWindow(dst,offset,count,source,positions,gains){
 const n=dst.length/2;for(let i=0;i<count;i++){const pos=positions(i),j=Math.floor(pos),f=pos-j;if(j<0||j>=source[0].length)continue;for(let ch=0;ch<2;ch++){const a=source[ch]||source[0],value=a[j]+((a[j+1]??a[j])-a[j])*f;dst[ch*n+offset+i]+=value*gains(i);}}
}

export const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
export const colors=()=>Object.fromEntries(['exposure','contrast','highlights','shadows','whites','blacks','temperature','tint','saturation','vibrance'].map(k=>[k,0]));
export function project(){return{version:1,id:uid(),name:'Untitled film',media:[],clips:[],aspect:'Original',intent:'HIGH FASHION',texts:[],effects:[],videoTracks:Array.from({length:3},(_,i)=>({name:['BASE','MIDDLE','UPPER'][i],hidden:false})),audioClips:[],audioTracks:Array.from({length:4},(_,i)=>({name:['原音','環境音','BGM','効果音'][i],mute:false,solo:false,volume:1})),bgm:{volume:.3,fadeIn:0,fadeOut:0},analysis:[],export:{preset:'INSTAGRAM REELS',resolution:'1080p',fps:'30',quality:'High',codec:'H.264'}}}
export function clip(m){return{id:uid(),media:m.id,kind:m.kind||'video',in:0,out:m.kind==='image'?5:m.duration,speed:1,endSpeed:1,curve:'constant',scale:1,x:.5,y:.5,motionPreset:'none',motionAmount:.12,stabilization:'OFF',interpolation:'duplicate',hold:0,color:colors(),audio:{volume:1,mute:false,fadeIn:0,fadeOut:0}}}
export function speedAt(t,c){let a=c.speed??1,b=c.endSpeed??a;if(c.curve==='constant')return a;if(c.curve==='ease-in')t*=t;else if(c.curve==='ease-out')t=1-(1-t)**2;else if(c.curve==='ease-in-out')t=t*t*(3-2*t);return a+(b-a)*t}
const timeCache=new WeakMap();
export function timing(c){const key=[c.in,c.out,c.speed,c.endSpeed,c.curve,c.hold,c.gap,c.freezeAt,c.freezeDuration,JSON.stringify(c.timingBase)].join("|");const old=timeCache.get(c);if(old?.key===key)return old.value;const value=computeTiming(c);timeCache.set(c,{key,value});return value}
function computeTiming(c){if(c.freezeDuration)return{nodes:[[0,0],[Math.max(.00001,c.out-c.in),c.freezeDuration]],pieces:[[0,Math.max(.00001,c.out-c.in),1,c.freezeDuration]],duration:c.freezeDuration};if(c.timingBase&&!c.gap){const base=computeTiming({...c.timingBase,hold:0,timingBase:null});const pieces=[],nodes=[[0,0]];let elapsed=0;const all=[[-Infinity,0,base.pieces[0][2]],...base.pieces,[base.nodes.at(-1)[0],Infinity,base.pieces.at(-1)[2]]];for(const [a,b,s] of all){const x=Math.max(c.in,c.timingBase.in+a),y=Math.min(c.out,c.timingBase.in+b);if(y<=x)continue;const d=(y-x)/s;pieces.push([x-c.in,y-c.in,s,d]);elapsed+=d;nodes.push([y-c.in,elapsed])}return{nodes,pieces,duration:elapsed+(c.hold||0)}}if(c.gap)return{nodes:[[0,0],[c.gap,c.gap]],pieces:[[0,c.gap,1,c.gap]],duration:c.gap};let d=c.out-c.in,n=c.curve==='constant'||c.speed===c.endSpeed?1:32,nodes=[[0,0]],pieces=[],elapsed=0;for(let i=0;i<n;i++){let x=d*i/n,y=d*(i+1)/n,s=speedAt((i+.5)/n,c),length=(y-x)/s;pieces.push([x,y,s,length]);elapsed+=length;nodes.push([y,elapsed])}return{nodes,pieces,duration:elapsed+(c.hold||0)}}
export function sourceOffset(t,c){if(c.freezeDuration)return 0;let{nodes}=timing(c);for(let i=1;i<nodes.length;i++){let[x0,y0]=nodes[i-1],[x1,y1]=nodes[i];if(t<=y1)return x0+(t-y0)*(x1-x0)/(y1-y0)}return c.out-c.in}
export function outputOffset(t,c){let{nodes}=timing(c);for(let i=1;i<nodes.length;i++){let[x0,y0]=nodes[i-1],[x1,y1]=nodes[i];if(t<=x1)return y0+(t-x0)*(y1-y0)/(x1-x0)}return nodes.at(-1)[1]}
const sequenceCache=new WeakMap();
export function sequence(p){
 const key=p.clips.map(c=>[c.id,c.start,c.layer,c.in,c.out,c.speed,c.endSpeed,c.curve,c.hold,c.gap,c.freezeAt,c.freezeDuration,JSON.stringify(c.timingBase)].join(':')).join('|');
 const cached=sequenceCache.get(p);if(cached?.key===key)return cached.rows;
 const ends=[0,0,0,0];const rows=p.clips.map(c=>{const layer=clamp(Math.round(c.layer||0),0,c.kind==='audio'?3:2),d=timing(c).duration,start=Number.isFinite(c.start)?Math.max(0,c.start):ends[layer];ends[layer]=Math.max(ends[layer],start+d);return{clip:c,layer,start,end:start+d,duration:d}});
 sequenceCache.set(p,{key,rows});return rows;
}
const audioViews=new WeakMap();
export function audioSequence(p){let view=audioViews.get(p);if(!view){view={clips:[]};audioViews.set(p,view)}view.clips=p.audioClips||[];return sequence(view)}
export function total(p){return Math.max(0,...sequence(p).map(r=>r.end),...audioSequence(p).map(r=>r.end))}
export function locate(p,t){
 const rows=sequence(p),end=total(p);if(!rows.length&&!end)return;
 if(t>=end)t=Math.max(0,end-1e-7);
 let found;for(const r of rows)if(!r.clip.gap&&t>=r.start&&t<r.end&&(!found||r.layer>=found.layer))found=r;
 return found||{clip:{gap:Math.max(end,0.01)},start:0,end,duration:end,layer:0};
}
// Render visibility windows without re-fitting speed curves. Original source timing,
// hold, stabilization and fades survive occlusion by the upper video layer.
export function visibleSequence(p){
 const rows=sequence(p),end=total(p),edges=[...new Set([0,end,...rows.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b),result=[];
 for(let i=1;i<edges.length;i++){const start=edges[i-1],stop=edges[i];if(stop-start<1e-9)continue;
 const row=locate(p,(start+stop)/2),last=result.at(-1),c=row.clip;
 if(last&&last.clip===c&&Math.abs(last.end-start)<1e-8){last.end=stop;last.duration=stop-last.start;continue}
 result.push({clip:c,start,end:stop,duration:stop-start,offset:c.gap?0:start-row.start,originalDuration:row.duration,layer:row.layer});
 }return result;
}
export function anchor(p){for(const r of sequence(p)){r.clip.start=r.start;r.clip.layer=r.layer}return p}
export function compileTimeline(p){
 const spans=visibleSequence(p),duration=total(p);
 const prepared=spans.map(r=>({...r,start:r.start-r.offset,end:r.end,offset:0,duration:r.originalDuration}));
 return {duration,locate(t){if(!spans.length)return;const at=clamp(t,0,Math.max(0,duration-1e-8));let lo=0,hi=spans.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(at<spans[mid].end)hi=mid;else lo=mid+1}return prepared[lo]}};
}
export function pasteClip(p,source,start,layer=0){anchor(p);const c=structuredClone(source);c.id=uid();c.start=Math.max(0,start);c.layer=clamp(Math.round(layer||0),0,source.kind==='audio'?3:2);p.clips.push(c);return c}
export function deleteClip(p,id,ripple=false){anchor(p);const row=sequence(p).find(r=>r.clip.id===id);if(!row)return;
 p.clips=p.clips.filter(c=>c.id!==id);
 if(ripple)for(const c of p.clips)if(c.layer===row.layer&&c.start>=row.end-1e-8)c.start=Math.max(row.start,c.start-row.duration);
}
export function splitClip(c,source){
 if(c.freezeDuration||c.gap||source<=c.in+.001||source>=c.out-.001)return null;
 const base=c.timingBase||Object.fromEntries(['in','out','speed','endSpeed','curve'].map(k=>[k,c[k]]));
 const offset=outputOffset(source-c.in,c),right=structuredClone(c);right.id=uid();right.in=source;
 c.out=source;c.hold=0;c.timingBase={...base};right.timingBase={...base};
 if(Number.isFinite(c.start))right.start=c.start+offset;
 return right;
}
export function trimClip(c,edge,source,mediaDuration){if(c.gap)return;const epsilon=.001;
 c[edge]=edge==='in'?clamp(source,0,c.out-epsilon):clamp(source,c.in+epsilon,mediaDuration);
}
export function format(t){t=Math.max(0,t||0);let h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=Math.floor(t%60),f=Math.floor((t%1)*100);return[h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(f).padStart(2,'0')}
export function sanitizeTexts(values=[]){return(Array.isArray(values)?values:[]).slice(0,20).map((t,i)=>{const start=clamp(+t.start||0,0,86400-1/60),end=clamp(Number.isFinite(+t.end)?+t.end:start+3,start+1/60,86400),font=String(t.font||'Sans').replace(/["'`;{}]/g,'').slice(0,80)||'Sans';return{id:String(t.id||`text-${i}`),text:String(t.text??'').slice(0,2000),font,align:['left','center','right'].includes(t.align)?t.align:'center',weight:[400,500,600,700,800].includes(+t.weight)?+t.weight:600,color:/^#[0-9a-f]{6}$/i.test(t.color||'')?t.color:'#ffffff',box:['none','dark','light'].includes(t.box)?t.box:'none',outline:0,size:clamp(+t.size||48,8,300),letterSpacing:clamp(+t.letterSpacing||0,-10,50),lineHeight:clamp(+t.lineHeight||1.12,.6,3),x:clamp(Number.isFinite(+t.x)?+t.x:.5,0,1),y:clamp(Number.isFinite(+t.y)?+t.y:.85,0,1),opacity:clamp(Number.isFinite(+t.opacity)?+t.opacity:1,0,1),fadeIn:clamp(Number.isFinite(+t.fadeIn)?+t.fadeIn:+t.fade||0,0,Math.min(120,(end-start)/2)),fadeOut:clamp(Number.isFinite(+t.fadeOut)?+t.fadeOut:+t.fade||0,0,Math.min(120,(end-start)/2)),motion:['none','rise','slide-left'].includes(t.motion)?t.motion:'none',motionDuration:clamp(+t.motionDuration||.4,.05,Math.min(120,(end-start)/2)),start,end}})}
export function sanitize(p){if(p?.version!==1||!Array.isArray(p.clips)||!Array.isArray(p.media)||p.clips.length>200||p.media.length>200)throw Error('対応していないプロジェクト形式です。');for(const c of p.clips){if(c.start!==undefined){if(!Number.isFinite(c.start)||c.start<0||c.start>86400)throw Error('配置時刻が無効です。');c.layer=clamp(Math.round(c.layer||0),0,c.kind==='audio'?3:2)}if(c.gap){c.gap=clamp(c.gap,.01,86400);continue}if(!p.media.some(m=>m.id===c.media))throw Error('素材情報が欠けています。');if(!Number.isFinite(c.in)||!Number.isFinite(c.out)||c.in<0||c.out<=c.in)throw Error('IN / OUT が無効です。');if(c.freezeDuration){c.freezeDuration=clamp(c.freezeDuration,1/30,60);c.freezeAt=clamp(c.freezeAt??c.in,0,p.media.find(m=>m.id===c.media).duration-.00001)}c.speed=clamp(c.speed??1,.05,20);c.endSpeed=clamp(c.endSpeed??c.speed,.05,20);c.motionPreset=['none','push-in','pull-out','pan-left','pan-right','pan-up','pan-down'].includes(c.motionPreset)?c.motionPreset:'none';c.motionAmount=clamp(Number.isFinite(+c.motionAmount)?+c.motionAmount:.12,0,.5);c.color={...colors(),...c.color};c.audio={volume:1,mute:false,fadeIn:0,fadeOut:0,...c.audio};c.curve=c.curve||'constant';if(c.timingBase){const b=c.timingBase;if(!Number.isFinite(b.in)||!Number.isFinite(b.out)||b.out<=b.in||b.in<0)throw Error('速度区間が無効です。');c.timingBase={in:b.in,out:b.out,speed:clamp(b.speed??1,.05,20),endSpeed:clamp(b.endSpeed??b.speed??1,.05,20),curve:b.curve||'constant'}}}if((p.audioClips||[]).length>200)throw Error('音声クリップは200個までです。');const defaults=project(),audioClips=(p.audioClips||[]).map(c=>{if(!p.media.some(m=>m.id===c.media)||!Number.isFinite(c.in)||!Number.isFinite(c.out)||c.in<0||c.out<=c.in)throw Error('音声の範囲が無効です。');return{...c,kind:'audio',linked:c.sourceClip?c.linked!==false:false,speed:clamp(c.speed??1,.05,20),endSpeed:clamp(c.endSpeed??c.speed??1,.05,20),curve:c.curve||'constant',hold:clamp(c.hold||0,0,10),layer:clamp(Math.round(c.layer||0),0,3),start:clamp(c.start||0,0,86400),audio:{volume:1,mute:false,fadeIn:0,fadeOut:0,...c.audio}}});return{...defaults,...p,videoTracks:Array.from({length:3},(_,i)=>({...defaults.videoTracks[i],...p.videoTracks?.[i],hidden:!!p.videoTracks?.[i]?.hidden})),audioClips,audioTracks:Array.from({length:4},(_,i)=>({...defaults.audioTracks[i],...p.audioTracks?.[i],volume:clamp(p.audioTracks?.[i]?.volume??1,0,2)})),analysis:p.analysis||[],effects:(p.effects||[]).slice(0,20).filter(e=>['flash','black-in','black-out'].includes(e.type)).map(e=>({...e,start:clamp(e.start,0,86400),duration:clamp(e.duration,1/60,86400),strength:clamp(e.strength??1,0,1)})),texts:sanitizeTexts(p.texts),bgm:p.bgm||{volume:.3}}}

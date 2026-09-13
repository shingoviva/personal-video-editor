import {timing,sourceOffset,clamp,trimClip} from './model.js';
import {sourceLimit} from './assets.js';

// A pointer gesture is a single history transaction, including touch/pen.
// Only geometry changes during dragging; no thumbnail DOM is rebuilt.
export function equalSpacingStart(value,span,row,rows,secondsPerPixel){
 const peers=rows.filter(r=>r.clip.id!==row.clip.id&&r.layer===row.layer).sort((a,b)=>a.start-b.start),previous=peers.filter(r=>r.end<=value+.0001).at(-1),next=peers.find(r=>r.start>=value+span-.0001);
 if(!previous||!next)return{start:value,spacing:false};
 const target=(previous.end+next.start-span)/2;
 return Math.abs(target-value)<=secondsPerPixel*8?{start:Math.max(0,target),spacing:true,previous:previous.end,next:next.start}:{start:value,spacing:false};
}

export function bindTimeline({root,rows,duration,select,begin,finish,cancel,preview,media,snap,getLayer,duplicate,snapTargets=()=>[]}){
 const pixels=root.getBoundingClientRect().width;
 const secondsPerPixel=Math.max(duration,.001)/Math.max(pixels,1);
 for(const el of root.querySelectorAll('[data-clip]')){
  el.onpointerdown=e=>{
   if(e.button!==0)return;
   let row=rows.find(r=>r.clip.id===el.dataset.clip);if(!row)return;
   const edge=e.target.closest('[data-edge]')?.dataset.edge;
   const origin=structuredClone(row.clip),x=e.clientX,y=e.clientY;
   let moved=false,lastPreview=0,ghost=null;
   select(row.clip.id,e);el.setPointerCapture(e.pointerId);
   el.onpointermove=ev=>{
    if(!moved&&Math.hypot(ev.clientX-x,ev.clientY-y)<5)return;
    if(!moved){begin();if(e.altKey&&!edge&&duplicate){ghost=el.cloneNode?.(true)||null;if(ghost){ghost.classList.add('duplicate-origin');ghost.removeAttribute?.('data-clip');el.parentNode?.insertBefore(ghost,el)}row=duplicate(row)||row;select(row.clip.id,e)}moved=true;el.classList.add('dragging')}
    let delta=(ev.clientX-x)*secondsPerPixel;
    const frame=1/30,targets=[0,...snapTargets(),...rows.filter(r=>r!==row).flatMap(r=>[r.start,r.end])];let didSnap=false;
    let spacingResult={spacing:false};const snapped=t=>{t=Math.round(t/frame)*frame;didSnap=false;if(snap()){let best=targets.reduce((found,a)=>Math.abs(a-t)<Math.abs((found??Infinity)-t)?a:found,undefined);if(best!==undefined&&Math.abs(best-t)<=secondsPerPixel*8){t=best;didSnap=true}}return Math.max(0,t)};
    const c=row.clip;
    if(!edge){
     c.start=snapped(row.start+delta);c.layer=getLayer(ev.clientY)??row.layer;if(snap()&&!didSnap){spacingResult=equalSpacingStart(c.start,timing(c).duration,{...row,layer:c.layer},rows,secondsPerPixel);c.start=spacingResult.start}
     el.style.top=((c.layer-row.layer)*(c.kind==='audio'?44:-52))+'px';
    }else{
     Object.assign(c,structuredClone(origin));c.start=row.start;c.layer=row.layer;
     const d=timing(origin).nodes.at(-1)[1],sourceAt=t=>t<0?t*origin.speed:t>d?origin.out-origin.in+(t-d)*(origin.curve==='constant'?origin.speed:origin.endSpeed):sourceOffset(t,origin);
     if(origin.freezeDuration){
      if(edge==='in'){c.start=clamp(snapped(row.start+delta),Math.max(0,row.end-60),row.end-1/30);c.freezeDuration=row.end-c.start}
      else c.freezeDuration=clamp(snapped(row.end+delta)-row.start,1/30,60);
     }else if(edge==='in'){
      const desired=snapped(row.start+delta)-row.start;
      trimClip(c,'in',origin.in+sourceAt(desired),sourceLimit(media(c)));
      c.start=Math.max(0,row.end-timing(c).duration);
      if(timing(c).duration>row.end){Object.assign(c,origin);c.start=row.start}
     }else trimClip(c,'out',origin.in+sourceAt(snapped(row.end+delta)-row.start-(origin.hold||0)),sourceLimit(media(c)));
    }
    el.style.left=c.start/Math.max(duration,.001)*100+'%';
    el.style.width=timing(c).duration/Math.max(duration,.001)*100+'%';
    const now=performance.now();if(now-lastPreview>100){lastPreview=now;preview(c,edge,didSnap,spacingResult)}
   };
   const cleanup=()=>{ghost?.remove?.();ghost=null;el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null};
   el.onpointerup=ev=>{cleanup();if(moved)finish();else{const t=row.start+clamp((ev.clientX-el.getBoundingClientRect().left)/Math.max(el.clientWidth,1),0,1)*row.duration;finish(t,false)}};
   el.onpointercancel=()=>{cleanup();if(moved)cancel()};
   el.onlostpointercapture=()=>{cleanup();if(moved)cancel()};
  };
 }
}

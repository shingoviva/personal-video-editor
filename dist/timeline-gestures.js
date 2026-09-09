import {timing,sourceOffset,clamp,trimClip} from './model.js';

// A pointer gesture is a single history transaction, including touch/pen.
// Only geometry changes during dragging; no thumbnail DOM is rebuilt.
export function bindTimeline({root,rows,duration,select,begin,finish,cancel,preview,media,snap,getLayer}){
 const pixels=root.getBoundingClientRect().width;
 const secondsPerPixel=Math.max(duration,.001)/Math.max(pixels,1);
 for(const el of root.querySelectorAll('[data-clip]')){
  el.onpointerdown=e=>{
   if(e.button!==0)return;
   const row=rows.find(r=>r.clip.id===el.dataset.clip);if(!row)return;
   const edge=e.target.closest('[data-edge]')?.dataset.edge;
   const origin=structuredClone(row.clip),x=e.clientX,y=e.clientY;
   let moved=false,lastPreview=0;
   select(row.clip.id);el.setPointerCapture(e.pointerId);
   el.onpointermove=ev=>{
    if(!moved&&Math.hypot(ev.clientX-x,ev.clientY-y)<5)return;
    if(!moved){begin();moved=true;el.classList.add('dragging')}
    let delta=(ev.clientX-x)*secondsPerPixel;
    const frame=1/30,targets=[0,...rows.filter(r=>r!==row).flatMap(r=>[r.start,r.end])];
    const snapped=t=>{t=Math.round(t/frame)*frame;if(snap()&&!ev.altKey){let best=targets.find(a=>Math.abs(a-t)<secondsPerPixel*8);if(best!==undefined)t=best}return Math.max(0,t)};
    const c=row.clip;
    if(!edge){
     c.start=snapped(row.start+delta);c.layer=getLayer(ev.clientY)??row.layer;
     el.style.top=(c.layer===row.layer?0:(c.layer===1?-1:1)*64)+'px';
    }else{
     Object.assign(c,structuredClone(origin));c.start=row.start;c.layer=row.layer;
     const d=timing(origin).nodes.at(-1)[1],sourceAt=t=>t<0?t*origin.speed:t>d?origin.out-origin.in+(t-d)*(origin.curve==='constant'?origin.speed:origin.endSpeed):sourceOffset(t,origin);
     if(edge==='in'){
      const desired=snapped(row.start+delta)-row.start;
      trimClip(c,'in',origin.in+sourceAt(desired),media(c).duration);
      c.start=Math.max(0,row.end-timing(c).duration);
      if(timing(c).duration>row.end){Object.assign(c,origin);c.start=row.start}
     }else trimClip(c,'out',origin.in+sourceAt(snapped(row.end+delta)-row.start-(origin.hold||0)),media(c).duration);
    }
    el.style.left=c.start/Math.max(duration,.001)*100+'%';
    el.style.width=timing(c).duration/Math.max(duration,.001)*100+'%';
    const now=performance.now();if(now-lastPreview>100){lastPreview=now;preview(c,edge)}
   };
   const cleanup=()=>{el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null};
   el.onpointerup=ev=>{cleanup();if(moved)finish();else{const t=row.start+clamp((ev.clientX-el.getBoundingClientRect().left)/Math.max(el.clientWidth,1),0,1)*row.duration;finish(t,false)}};
   el.onpointercancel=()=>{cleanup();if(moved)cancel()};
   el.onlostpointercapture=()=>{cleanup();if(moved)cancel()};
  };
 }
}

import {clamp} from './model.js';

// Keep overlay items frame-aligned, then magnetize either edge to the playhead
// or an edit boundary. Eight screen pixels keeps the feel stable at any zoom.
export function snapOverlayStart(value,span,{duration,pixels,enabled=true,bypass=false,targets=[]}={}){
 const frame=1/30,limit=Math.max(0,(duration||0)-Math.max(0,span||0)),raw=clamp(value,0,limit);
 let start=Math.round(raw/frame)*frame,snapped=false,target=null,best=Infinity;
 if(enabled&&!bypass){
  const threshold=Math.max(duration||0,.001)/Math.max(pixels||0,1)*8;
  for(const point of new Set(targets.filter(Number.isFinite))){
   for(const edge of [0,span]){
    const candidate=point-edge,distance=Math.abs(candidate-raw);
    if(candidate>=0&&candidate<=limit&&distance<=threshold&&distance<best){start=candidate;best=distance;snapped=true;target=point}
   }
  }
 }
 return{start:clamp(start,0,limit),snapped,target};
}

export function bindOverlayTimeline({root,effects=[],texts=[],duration,targets,snap,select,begin,finish,cancel,preview}){
 const pixels=Math.max(1,root.getBoundingClientRect().width),secondsPerPixel=Math.max(duration,.001)/pixels;
 for(const el of root.querySelectorAll('[data-fx],[data-text-chip]')){
  el.onpointerdown=event=>{
   if(event.button!==0)return;
   const kind=el.dataset.fx?'effect':'text',item=(kind==='effect'?effects:texts).find(value=>value.id===(el.dataset.fx||el.dataset.textChip));
   if(!item)return;
   const origin=structuredClone(item),originStart=kind==='effect'?origin.start:origin.start,span=kind==='effect'?origin.duration:origin.end-origin.start,x=event.clientX;
   let moved=false,lastResult={snapped:false,target:null};select(kind,item.id);el.setPointerCapture(event.pointerId);
   el.onpointermove=move=>{
    if(!moved&&Math.abs(move.clientX-x)<5)return;
    if(!moved){begin();moved=true;el.classList.add('dragging')}
    lastResult=snapOverlayStart(originStart+(move.clientX-x)*secondsPerPixel,span,{duration,pixels,enabled:snap(),bypass:move.altKey,targets:targets(item,kind)});
    item.start=lastResult.start;if(kind==='text')item.end=item.start+span;
    el.style.left=item.start/Math.max(duration,.001)*100+'%';preview(item,kind,lastResult);
   };
   const cleanup=()=>{el.classList.remove('dragging');el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null};
   el.onpointerup=()=>{cleanup();if(moved)finish(item,kind,lastResult)};
   el.onpointercancel=()=>{cleanup();if(moved){Object.assign(item,origin);cancel()}};
   el.onlostpointercapture=()=>{cleanup();if(moved){Object.assign(item,origin);cancel()}};
  };
 }
}

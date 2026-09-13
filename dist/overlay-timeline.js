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

export function bindOverlayTimeline({root,effects=[],texts=[],duration,targets,snap,select,begin,finish,cancel,preview,duplicate,groupItems=()=>[]}){
 const pixels=Math.max(1,root.getBoundingClientRect().width),secondsPerPixel=Math.max(duration,.001)/pixels;
 for(const el of root.querySelectorAll('[data-fx],[data-text-chip]')){
  el.onpointerdown=event=>{
   if(event.button!==0)return;
   const kind=el.dataset.fx?'effect':'text';let item=(kind==='effect'?effects:texts).find(value=>value.id===(el.dataset.fx||el.dataset.textChip));
   if(!item)return;
   const origin=structuredClone(item),originStart=origin.start,originSpan=kind==='effect'?origin.duration:origin.end-origin.start,x=event.clientX,edge=event.target?.closest?.('[data-overlay-edge]')?.dataset.overlayEdge;
   let moved=false,lastResult={snapped:false,target:null},ghost=null,companions=[];select(kind,item.id,event);el.setPointerCapture(event.pointerId);
   el.onpointermove=move=>{
    if(!moved&&Math.abs(move.clientX-x)<5)return;
    if(!moved){begin();if(event.altKey&&!edge&&duplicate){ghost=el.cloneNode?.(true)||null;if(ghost){ghost.classList.add('duplicate-origin');el.parentNode?.insertBefore(ghost,el)}item=duplicate(item,kind)||item;select(kind,item.id,event)}else if(!edge)companions=groupItems(item,kind).filter(v=>v.item.id!==item.id);moved=true;el.classList.add('dragging')}
    const delta=(move.clientX-x)*secondsPerPixel,frame=1/30;
    if(edge==='in'){const end=originStart+originSpan;lastResult=snapOverlayStart(originStart+delta,0,{duration:end-frame,pixels,enabled:snap(),targets:targets(item,kind)});item.start=Math.min(end-frame,lastResult.start);if(kind==='effect')item.duration=end-item.start;else item.end=end}
    else if(edge==='out'){const endResult=snapOverlayStart(originStart+originSpan+delta,0,{duration,pixels,enabled:snap(),targets:targets(item,kind)}),end=Math.max(originStart+frame,endResult.start);lastResult={...endResult,start:originStart};item.start=originStart;if(kind==='effect')item.duration=end-originStart;else item.end=end}
    else{lastResult=snapOverlayStart(originStart+delta,originSpan,{duration,pixels,enabled:snap(),targets:targets(item,kind)});const low=Math.min(originStart,...companions.map(v=>v.start)),high=Math.max(originStart+originSpan,...companions.map(v=>v.start+v.span)),actual=clamp(lastResult.start-originStart,-low,duration-high),surface=root.closest?.('.timeline-content')||root;item.start=originStart+actual;if(kind==='text')item.end=item.start+originSpan;for(const value of companions){value.item.start=value.start+actual;if(value.kind==='text')value.item.end=value.item.start+value.span;const node=[...surface.querySelectorAll('[data-clip],[data-fx],[data-text-chip]')].find(n=>(n.dataset.clip||n.dataset.fx||n.dataset.textChip)===value.item.id);if(node)node.style.left=value.item.start/Math.max(duration,.001)*100+'%'}}
    const itemSpan=kind==='effect'?item.duration:item.end-item.start;el.style.left=item.start/Math.max(duration,.001)*100+'%';el.style.width=itemSpan/Math.max(duration,.001)*100+'%';preview(item,kind,lastResult,edge);
   };
   const cleanup=()=>{ghost?.remove?.();ghost=null;el.classList.remove('dragging');el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null};
   el.onpointerup=()=>{cleanup();if(moved)finish(item,kind,lastResult)};
   el.onpointercancel=()=>{cleanup();if(moved)cancel()};
   el.onlostpointercapture=()=>{cleanup();if(moved)cancel()};
  };
 }
}

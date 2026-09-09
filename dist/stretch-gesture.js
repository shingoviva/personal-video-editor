import {stretchClip} from './creative.js';
// Mouse drag or two-finger pinch. A cancelled gesture restores its transaction.
export function bindStretch(el,{clip,begin,change,finish,cancel}){
 const points=new Map();let original,base=1,startX=0,active=false;
 const distance=()=>{const p=[...points.values()];return Math.max(8,Math.abs(p[0]-p[1]))};
 el.onpointerdown=e=>{if(e.button!==0||points.size>=2)return;e.preventDefault();points.set(e.pointerId,e.clientX);el.setPointerCapture(e.pointerId);
  if(!active){begin();original=structuredClone(clip());startX=e.clientX;active=true}
  if(points.size===2){original=structuredClone(clip());base=distance()}
 };
 el.onpointermove=e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,e.clientX);const ratio=points.size===2?distance()/base:Math.pow(2,(e.clientX-startX)/120);stretchClip(clip(),original,ratio);change()};
 el.onpointerup=e=>{points.delete(e.pointerId);if(!points.size&&active){active=false;finish()}else if(points.size){original=structuredClone(clip());startX=[...points.values()][0]}};
 const abort=()=>{if(active){active=false;points.clear();cancel()}};
 el.onpointercancel=abort;el.onlostpointercapture=e=>{if(points.has(e.pointerId))abort()};
}

import {clamp} from './model.js';

export function centeredTransform(origin,dx,dy,width,height,threshold=8){
 let x=clamp((origin.x??.5)-dx/Math.max(width,1),0,1),y=clamp((origin.y??.5)-dy/Math.max(height,1),0,1),snapX=false,snapY=false;
 if(Math.abs(x-.5)*width<=threshold){x=.5;snapX=true}if(Math.abs(y-.5)*height<=threshold){y=.5;snapY=true}
 return{x,y,snapX,snapY};
}
export function scaleFromWheel(scale,delta){return clamp((scale??1)*Math.exp(-delta*.002),1,3)}

export function bindStageTransform({root,getClip,enabled,begin,change,finish,guides,status=()=>{}}){
 let drag=null,wheelTimer=null;
 root.addEventListener('pointerdown',event=>{if(event.button!==0||!enabled()||event.pointerType==='touch'&&event.isPrimary===false)return;const clip=getClip();if(!clip)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{x:clip.x??.5,y:clip.y??.5},moved:false};root.setPointerCapture?.(event.pointerId)},true);
 root.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const rect=root.getBoundingClientRect(),distance=Math.hypot(event.clientX-drag.x,event.clientY-drag.y);if(!drag.moved&&distance<4)return;if(!drag.moved){drag.moved=true;begin()}const next=centeredTransform(drag.origin,event.clientX-drag.x,event.clientY-drag.y,rect.width,rect.height);change(next);guides(next);status(`位置 X ${next.x.toFixed(2)} · Y ${next.y.toFixed(2)}${next.snapX||next.snapY?' · 中央に吸着':''}`);event.preventDefault()},true);
 const end=event=>{if(!drag||event.pointerId!==drag.id)return;const moved=drag.moved;drag=null;guides(null);if(moved)finish()};root.addEventListener('pointerup',end,true);root.addEventListener('pointercancel',end,true);
 root.addEventListener('wheel',event=>{if(!enabled()||!(event.ctrlKey||event.metaKey))return;event.preventDefault();if(!wheelTimer)begin();const clip=getClip(),next=scaleFromWheel(clip.scale,event.deltaY);change({scale:next});status(`サイズ ${next.toFixed(2)}×`);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelTimer=null;finish()},140)},{passive:false});
 for(const name of ['gesturestart','gesturechange','gestureend'])root.addEventListener(name,event=>event.preventDefault(),{passive:false});
}

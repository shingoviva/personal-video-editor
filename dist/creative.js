import {clamp,timing,sequence,uid,pasteClip,sourceOffset} from './model.js';
export function clipAlpha(row,t){if(!row||t<row.start||t>=row.end)return 0;const c=row.clip,d=timing(c).duration,local=t-row.start+(row.offset||0),fi=Math.min(c.fadeIn||0,d/2),fo=Math.min(c.fadeOut||0,d/2);return clamp(c.opacity??1,0,1)*Math.max(0,Math.min(1,fi?local/fi:1,fo?(d-local)/fo:1))}
export function effectAlpha(e,t){if(t<e.start||t>=e.start+e.duration)return 0;const u=clamp((t-e.start)/e.duration,0,1);return clamp(e.strength??1,0,1)*(e.type==='black-out'?u:1-u)}
export function textPose(text,t){
 const d=Math.max(.001,text.end-text.start),fi=Math.min(text.fadeIn??text.fade??0,d/2),fo=Math.min(text.fadeOut??text.fade??0,d/2);
 const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},md=Math.min(text.motionDuration??.4,d/2);
 const shift=.06*(1-ease((t-text.start)/Math.max(.001,md))-ease((t-(text.end-md))/Math.max(.001,md)));
 const enter=ease((t-text.start)/Math.max(.001,md)),leave=ease((text.end-t)/Math.max(.001,md));
 return{alpha:t<text.start||t>=text.end?0:clamp(text.opacity??1,0,1)*Math.max(0,Math.min(1,fi?(t-text.start)/fi:1,fo?(text.end-t)/fo:1)),x:(text.x??.5)+(text.motion==='slide-left'?shift:0),y:(text.y??.85)+(text.motion==='rise'?shift:0),scale:text.motion==='pop'?.82+.18*Math.min(enter,leave):1};
}
export function frozenClip(p,id,t,seconds=1){
 const row=sequence(p).find(r=>r.clip.id===id);if(!row||row.clip.gap)return null;
 const c=row.clip,source=c.kind==='image'?0:c.freezeAt??Math.min(c.out-.001,c.in+sourceOffset(clamp(t-row.start,0,row.duration),c));
 const frozen={...structuredClone(c),freezeAt:source,freezeDuration:clamp(seconds,1/30,60),in:source,out:Math.max(source+.001,Math.min(c.out,source+1/30)),hold:0,speed:1,endSpeed:1,curve:'constant',stabilization:'OFF',fadeIn:0,fadeOut:0};
 delete frozen.timingBase;frozen.audio={...c.audio,mute:true};return pasteClip(p,frozen,Math.max(0,t),2);
}
export function addEffect(p,type,t){const e={id:uid(),type,start:Math.max(0,t),duration:type==='flash'?.16:.6,strength:1};(p.effects??=[]).push(e);return e}

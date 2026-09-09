import {audioWindows,trackGain} from './audio-timeline.js';
import {sourceTime,gainAt,held} from './mobile-model.js';
import {timing} from './model.js';
// Four streaming media elements, never full-song AudioBuffers.
export class AudioPreview{
 constructor(){this.voices=Array.from({length:4},()=>{const v=document.createElement('audio');v.preload='metadata';v.preservesPitch=false;return v})}
 sync(p,t,playing,urlOf){
  const rows=audioWindows(p);
  for(let k=0;k<4;k++){const v=this.voices[k],row=rows.find(r=>r.layer===k&&r.start<=t&&t<r.end),c=row?.clip,m=p.media.find(m=>m.id===c?.media),url=m&&urlOf(m);
   if(!row||!url||c.audio.mute||!trackGain(p,k)||held(row,t)){v.pause();continue}
   const source=sourceTime(row,t),local=t-row.start+(row.offset||0),tm=timing(c),i=tm.nodes.findIndex(n=>n[1]>=local),speed=tm.pieces[Math.max(0,i-1)]?.[2]||1;
   if(v.dataset.url!==url){v.pause();v.dataset.url=url;v.src=url;v.load()}
   const at=c.loop?source%m.duration:source;v.loop=!!c.loop;v.volume=Math.min(1,trackGain(p,k)*gainAt(local,tm.duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut));
   if(v.readyState>=1&&!v.seeking&&Math.abs(v.currentTime-at)>.08)try{v.currentTime=at}catch{}
   if(playing&&speed>=.25&&speed<=4){v.playbackRate=speed;if(v.paused)v.play().catch(()=>{})}else v.pause();
  }
 }
 pause(){this.voices.forEach(v=>v.pause())}
 dispose(){this.voices.forEach(v=>{v.pause();v.removeAttribute('src');v.load()})}
}

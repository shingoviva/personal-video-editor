import {audioWindows,trackGain} from './audio-timeline.js';
import {sourceTime,gainAt,held} from './mobile-model.js';
import {sequence,timing} from './model.js';

const mediaVoice=()=>{const value=document.createElement('audio');value.preload='metadata';value.preservesPitch=false;return value};

// Three source-video voices plus four independent audio tracks. Media elements
// stream compressed audio and avoid expanding long clips into RAM.
export class AudioPreview{
 constructor(){this.voices=Array.from({length:7},mediaVoice)}
 syncVoice(v,row,p,t,playing,urlOf,gain,loop=false){
  const c=row?.clip,m=p.media.find(item=>item.id===c?.media),url=m&&urlOf(m);
  if(!row||!url||!m?.audio||c.audio?.mute||!gain||held(row,t)){v.pause();return}
  const source=sourceTime(row,t),local=t-row.start+(row.offset||0),tm=timing(c),i=tm.nodes.findIndex(n=>n[1]>=local),speed=tm.pieces[Math.max(0,i-1)]?.[2]||1;
  if(v.dataset.url!==url){v.pause();v.dataset.url=url;v.src=url;v.load()}
  const at=loop?source%m.duration:source;v.loop=loop;v.volume=Math.min(1,gain*gainAt(local,tm.duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut));
  if(v.readyState>=1&&!v.seeking&&Math.abs(v.currentTime-at)>.08)try{v.currentTime=at}catch{}
  if(playing&&speed>=.25&&speed<=4&&!c.freezeDuration){v.playbackRate=speed;if(v.paused)v.play().catch(()=>{})}else v.pause();
 }
 sync(p,t,playing,urlOf){
  const audioRows=audioWindows(p);
  for(let layer=0;layer<4;layer++){const row=audioRows.find(value=>value.layer===layer&&value.start<=t&&t<value.end);this.syncVoice(this.voices[3+layer],row,p,t,playing,urlOf,trackGain(p,layer),!!row?.clip.loop)}
  const solo=!!p.audioTracks?.some(track=>track.solo),rows=sequence(p);
  for(let layer=0;layer<3;layer++){const row=[...rows].reverse().find(value=>value.layer===layer&&!value.clip.gap&&value.start<=t&&t<value.end),track=p.videoTracks?.[layer]||{};this.syncVoice(this.voices[layer],row,p,t,playing,urlOf,solo||track.hidden?0:Math.max(0,Math.min(2,track.volume??1)))}
 }
 pause(){this.voices.forEach(v=>v.pause())}
 dispose(){this.voices.forEach(v=>{v.pause();v.removeAttribute('src');v.load()})}
}

import {audioWindows,trackGain} from './audio-timeline.js';
import {sourceTime,gainAt,held,declickGain} from './mobile-model.js';
import {sequence,timing} from './model.js';

const mediaVoice=()=>{const value=document.createElement('audio');value.preload='auto';value.preservesPitch=false;return value};
export const previewDriftTolerance=playing=>playing?.32:.035;
const keyFor=(row,url)=>row&&url?`${row.clip.id}|${url}`:'';

// Two voices per lane let the next clip decode before the playhead reaches it.
export class AudioPreview{
 constructor(){this.lanes=Array.from({length:7},()=>({voices:[mediaVoice(),mediaVoice()],active:0}));this.voices=this.lanes.flatMap(lane=>lane.voices)}
 prepare(lane,row,p,urlOf){
  const c=row?.clip,m=p.media.find(item=>item.id===c?.media),url=m&&urlOf(m),key=keyFor(row,url);if(!key)return null;
  let index=lane.voices.findIndex(voice=>voice.dataset.key===key);if(index<0){index=1-lane.active;const voice=lane.voices[index];voice.pause();voice.dataset.key=key;voice.dataset.url=url;voice.src=url;voice.load();const at=c.loop?sourceTime(row,row.start)%m.duration:sourceTime(row,row.start);const seek=()=>{try{voice.currentTime=at}catch{}};voice.readyState>=1?seek():voice.addEventListener('loadedmetadata',seek,{once:true})}return index;
 }
 syncLane(lane,row,p,t,playing,urlOf,gain,loop=false){
  const c=row?.clip,m=p.media.find(item=>item.id===c?.media),url=m&&urlOf(m);
  if(!row||!url||!m?.audio||c.audio?.mute||!gain||held(row,t)){lane.voices.forEach(voice=>voice.pause());return}
  const index=this.prepare(lane,row,p,urlOf);if(index!==lane.active){lane.voices[lane.active].pause();lane.active=index}
  const voice=lane.voices[index],source=sourceTime(row,t),local=t-row.start+(row.offset||0),tm=timing(c),i=tm.nodes.findIndex(node=>node[1]>=local),speed=tm.pieces[Math.max(0,i-1)]?.[2]||1,at=loop?source%m.duration:source;
  voice.loop=loop;voice.volume=Math.min(1,gain*gainAt(local,tm.duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut,c.audio.gainKeyframes)*declickGain(local,tm.duration,.04));
  if(voice.readyState>=1&&!voice.seeking&&Math.abs(voice.currentTime-at)>previewDriftTolerance(playing))try{voice.currentTime=at}catch{}
  if(playing&&speed>=.25&&speed<=4&&!c.freezeDuration){voice.playbackRate=speed;if(voice.readyState>=2&&voice.paused)voice.play().catch(()=>{})}else voice.pause();
 }
 primeNext(lane,rows,p,t,urlOf){const next=rows.filter(row=>row.start>t&&row.start-t<1.5).sort((a,b)=>a.start-b.start)[0];if(next)this.prepare(lane,next,p,urlOf)}
 sync(p,t,playing,urlOf){
  const audioRows=audioWindows(p);
  for(let layer=0;layer<4;layer++){const rows=audioRows.filter(value=>value.layer===layer),row=rows.find(value=>value.start<=t&&t<value.end);this.syncLane(this.lanes[3+layer],row,p,t,playing,urlOf,trackGain(p,layer),!!row?.clip.loop);this.primeNext(this.lanes[3+layer],rows,p,t,urlOf)}
  const solo=!!p.audioTracks?.some(track=>track.solo),all=sequence(p);
  for(let layer=0;layer<3;layer++){const rows=all.filter(value=>value.layer===layer&&!value.clip.gap),row=[...rows].reverse().find(value=>value.start<=t&&t<value.end),track=p.videoTracks?.[layer]||{};this.syncLane(this.lanes[layer],row,p,t,playing,urlOf,solo||track.hidden?0:Math.max(0,Math.min(2,track.volume??1)));this.primeNext(this.lanes[layer],rows,p,t,urlOf)}
 }
 pause(){this.voices.forEach(voice=>voice.pause())}
 dispose(){this.voices.forEach(voice=>{voice.pause();voice.removeAttribute('src');voice.load();delete voice.dataset.key;delete voice.dataset.url})}
}

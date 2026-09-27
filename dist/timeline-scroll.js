export function nearestLaneScroll(value,stops){
 const ordered=[...new Set(stops.filter(Number.isFinite).map(v=>Math.max(0,v)))].sort((a,b)=>a-b);
 return ordered.reduce((best,next)=>Math.abs(next-value)<Math.abs(best-value)?next:best,ordered[0]??0);
}

export function bindTimelineLaneScroll({scroll,labels,header,lanes,delay=100}){
 let timer=0;
 const stops=()=>{const box=scroll.getBoundingClientRect(),top=header.offsetHeight;return[0,...lanes().map(lane=>lane.getBoundingClientRect().top-box.top+scroll.scrollTop-top)];};
 const sync=()=>{
  labels.style.transform=`translateY(-${scroll.scrollTop}px)`;
  clearTimeout(timer);timer=setTimeout(()=>{const target=nearestLaneScroll(scroll.scrollTop,stops());if(Math.abs(target-scroll.scrollTop)>.5)scroll.scrollTop=target},delay);
 };
 scroll.addEventListener('scroll',sync,{passive:true});sync();
 return()=>{clearTimeout(timer);scroll.removeEventListener('scroll',sync)};
}

export const CURVE_KEYS=['curveMaster','curveRed','curveGreen','curveBlue'];
export const CURVE_IDENTITY=Object.freeze([0,.25,.5,.75,1]);
export function normalizeCurve(value){
 const source=Array.isArray(value)?value:CURVE_IDENTITY;
 return CURVE_IDENTITY.map((fallback,i)=>Math.max(0,Math.min(1,Number.isFinite(+source[i])?+source[i]:fallback)));
}
export function curveAt(value,x){
 const points=normalizeCurve(value),position=Math.max(0,Math.min(1,+x||0))*4,index=Math.min(3,Math.floor(position)),t=position-index;
 return points[index]+(points[index+1]-points[index])*t;
}
export function curveColor(color,amount=1){
 const mix=curve=>normalizeCurve(curve).map((value,i)=>i/4+(value-i/4)*amount);
 return Object.fromEntries(CURVE_KEYS.map(key=>[key,mix(color?.[key])]));
}
export function bindToneCurve(canvas,{getColor,channel='curveMaster',onStart=()=>{},onInput=()=>{},onEnd=()=>{}}={}){
 if(!canvas)return()=>{};const ctx=canvas.getContext('2d'),ratio=Math.max(1,globalThis.devicePixelRatio||1);let active=-1;
 const size=()=>{const box=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(box.width*ratio));canvas.height=Math.max(1,Math.round(box.height*ratio));return{w:canvas.width,h:canvas.height,p:12*ratio}};
 const draw=()=>{const{w,h,p}=size(),points=normalizeCurve(getColor()?.[channel]);ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b0f0c';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#293329';ctx.lineWidth=ratio;for(let i=0;i<=4;i++){const x=p+(w-p*2)*i/4,y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(x,p);ctx.lineTo(x,h-p);ctx.stroke();ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}ctx.strokeStyle={curveMaster:'#e5edc0',curveRed:'#ff746e',curveGreen:'#77d996',curveBlue:'#79a8ff'}[channel];ctx.lineWidth=2*ratio;ctx.beginPath();points.forEach((value,i)=>{const x=p+(w-p*2)*i/4,y=h-p-value*(h-p*2);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();points.forEach((value,i)=>{const x=p+(w-p*2)*i/4,y=h-p-value*(h-p*2);ctx.fillStyle=i===active?'#fff':ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,4.5*ratio,0,Math.PI*2);ctx.fill()})};
 const update=e=>{if(active<0)return;const box=canvas.getBoundingClientRect(),p=12,value=1-Math.max(p,Math.min(box.height-p,e.clientY-box.top))/(box.height);const next=normalizeCurve(getColor()?.[channel]);next[active]=Math.max(0,Math.min(1,value));onInput(channel,next);draw()};
 canvas.onpointerdown=e=>{const box=canvas.getBoundingClientRect(),p=12,x=Math.max(p,Math.min(box.width-p,e.clientX-box.left));active=Math.max(0,Math.min(4,Math.round((x-p)/(box.width-p*2)*4)));canvas.setPointerCapture(e.pointerId);onStart();update(e)};
 canvas.onpointermove=update;canvas.onpointerup=canvas.onpointercancel=e=>{if(active>=0){active=-1;canvas.releasePointerCapture?.(e.pointerId);onEnd();draw()}};draw();return draw;
}

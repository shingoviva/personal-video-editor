import {colors,clamp} from './model.js';
export const lookPresets={
 CLEAN:{...colors()},HARD:{...colors(),contrast:65,blacks:-32,highlights:-16,saturation:-22},
 COLD:{...colors(),temperature:-40,tint:8,contrast:28,saturation:-18},
 WARM:{...colors(),temperature:38,tint:5,contrast:18,shadows:12},
 RAW:{...colors(),contrast:-20,blacks:12,saturation:-14},
 NIGHT:{...colors(),exposure:-.8,temperature:-32,contrast:35,blacks:-28,saturation:-20},
 UNDER:{...colors(),exposure:-.32,contrast:24,highlights:-34,shadows:-5,whites:-12,blacks:-18,temperature:-5,tint:3,saturation:-12,vibrance:9},
 EDITORIAL:{...colors(),contrast:42,highlights:-24,shadows:10,blacks:-18,saturation:-35},
 MONO:{...colors(),contrast:35,highlights:-20,blacks:-20,saturation:-100}
};
export const lookDescriptions={CLEAN:'補正なし',HARD:'硬い黒・強い輪郭',COLD:'冷たい青・低彩度',WARM:'暖かい光・柔らかな影',RAW:'浅い黒・穏やかな階調',NIGHT:'低露出・深い青',UNDER:'深い黒・保護したハイライト',EDITORIAL:'抑えた色・締まった黒',MONO:'モノクロ・明確な明暗'};
export function adaptiveCinematic(stats={}){
 const luma=clamp(stats.luma??.5,.02,.98),contrast=clamp(stats.contrast??.45,.02,.95),clipping=clamp(stats.clipping??0,0,1);
 return{...colors(),exposure:clamp(-.28+(.43-luma)*.55,-.58,-.08),contrast:clamp(18+( .42-contrast)*28,12,32),highlights:clamp(-28-clipping*45,-52,-24),shadows:luma<.3?8:-7,whites:-12,blacks:clamp(-15-(.45-contrast)*16,-24,-10),temperature:-4,tint:3,saturation:-10,vibrance:clamp(8+( .35-contrast)*12,5,13)};
}
export function gradeRGB(rgb,col,amount=1){
 const c=Object.fromEntries(Object.entries({...colors(),...col}).map(([k,v])=>[k,v*amount])),o=[...rgb];c.saturation=Math.max(-100,c.saturation);
 let v=o.map((x,i)=>clamp((x*Math.pow(2,c.exposure)-.5)*(1+c.contrast/150)+.5+c.shadows/400*(1-x)**2+c.highlights/400*x*x+c.whites/500*x**4+c.blacks/500*(1-x)**4+[c.temperature/400+c.tint/800,-c.tint/400,-c.temperature/400+c.tint/800][i],0,1));
 const l=v[0]*.299+v[1]*.587+v[2]*.114;v=v.map(x=>l+(x-l)*(1+c.saturation/100));
 const factor=1+c.vibrance/100*(1-(Math.max(...v)-Math.min(...v)));return v.map(x=>clamp(l+(x-l)*factor,0,1));
}

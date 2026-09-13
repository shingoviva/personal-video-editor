import {textPose} from './creative.js';

const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#ffffff';
const safeFont=value=>String(value||'Sans').replace(/["'`;{}]/g,'').slice(0,80)||'Sans';
export function textStyle(text={}){return{
 font:safeFont(text.font),
 align:['left','center','right'].includes(text.align)?text.align:'center',
 weight:[400,500,600,700,800].includes(+text.weight)?+text.weight:600,
 color:color(text.color),outline:0,letterSpacing:Math.max(-10,Math.min(50,+text.letterSpacing||0)),lineHeight:Math.max(.6,Math.min(3,+text.lineHeight||1.12)),
 box:['none','dark','light'].includes(text.box)?text.box:'none'
}}
export const fontFamily=font=>font==='Serif'?'Georgia, "Times New Roman", serif':font==='Mono'?'"SFMono-Regular", Menlo, monospace':font==='Sans'?'Arial, "Hiragino Sans", sans-serif':`"${safeFont(font)}", Arial, sans-serif`;
const lines=text=>String(text.text??'').slice(0,2000).split('\n').slice(0,20);
const lineWidth=(ctx,line,spacing)=>ctx.measureText(line||' ').width+Math.max(0,[...line].length-1)*spacing;
function drawSpaced(ctx,line,x,y,maxWidth,spacing,align){const chars=[...line],width=Math.min(maxWidth,lineWidth(ctx,line,spacing));let at=align==='left'?x:align==='right'?x-width:x-width/2;ctx.textAlign='left';for(const char of chars){ctx.fillText(char,at,y,maxWidth);at+=ctx.measureText(char).width+spacing}}
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
export function drawTextCanvas(ctx,text,time,w,h){
 const pose=textPose(text,time);if(!pose.alpha)return false;const style=textStyle(text),rows=lines(text),size=Math.max(1,Math.min((+text.size||48)*h/1080,h*.9/(rows.length*style.lineHeight))),lineHeight=size*style.lineHeight,spacing=style.letterSpacing*h/1080,maxWidth=w*.92;
 ctx.save();ctx.globalAlpha=pose.alpha;ctx.font=`${style.weight} ${size}px ${fontFamily(style.font)}`;ctx.textAlign=style.align;ctx.textBaseline='middle';ctx.lineJoin='round';
 const x=pose.x*w,y=pose.y*h,width=Math.min(maxWidth,Math.max(...rows.map(line=>lineWidth(ctx,line,spacing)),1)),height=Math.max(lineHeight,rows.length*lineHeight),left=style.align==='left'?x:style.align==='right'?x-width:x-width/2;
 if(style.box!=='none'){const pad=size*.24;ctx.fillStyle=style.box==='light'?'rgba(246,247,239,.82)':'rgba(5,8,6,.62)';roundRect(ctx,left-pad,y-height/2-pad,width+pad*2,height+pad*2,size*.12);ctx.fill()}
 rows.forEach((line,index)=>{const ly=y+(index-(rows.length-1)/2)*lineHeight;ctx.fillStyle=style.color;drawSpaced(ctx,line,x,ly,maxWidth,spacing,style.align)});
 ctx.restore();return true;
}
export function rasterizeText(text){
 const style=textStyle(text),rows=lines(text),size=Math.max(8,Math.min(300,+text.size||48,1080*.84/(rows.length*style.lineHeight))),probe=document.createElement('canvas').getContext('2d');probe.font=`${style.weight} ${size}px ${fontFamily(style.font)}`;
 const maxWidth=1920*.88,lineHeight=size*style.lineHeight,spacing=style.letterSpacing,pad=Math.ceil(size*.3),width=Math.max(2,Math.ceil(Math.min(maxWidth,Math.max(...rows.map(line=>lineWidth(probe,line,spacing)),1))+pad*2)),height=Math.max(2,Math.ceil(rows.length*lineHeight+pad*2));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.font=`${style.weight} ${size}px ${fontFamily(style.font)}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 if(style.box!=='none'){ctx.fillStyle=style.box==='light'?'rgba(246,247,239,.82)':'rgba(5,8,6,.62)';roundRect(ctx,0,0,width,height,size*.12);ctx.fill()}
 rows.forEach((line,index)=>{const y=height/2+(index-(rows.length-1)/2)*lineHeight;ctx.fillStyle=style.color;drawSpaced(ctx,line,width/2,y,maxWidth,spacing,'center')});
 return{data:canvas.toDataURL('image/png'),width,height};
}
export function withTextRasters(project){const copy=structuredClone(project);copy.texts=copy.texts.map(text=>({...text,raster:rasterizeText(text)}));return copy}

export class TextPreview{
 constructor(root){this.root=root;this.nodes=new Map();this.signature=''}
 sync(texts){const signature=texts.map(t=>JSON.stringify([t.id,t.text,textStyle(t)])).join('|');if(signature===this.signature)return;this.signature=signature;const wanted=new Set(texts.map(t=>t.id));for(const[id,node]of this.nodes)if(!wanted.has(id)){node.remove();this.nodes.delete(id)}
  for(const text of texts){let node=this.nodes.get(text.id);if(!node){node=document.createElement('div');node.className='text-item';this.root.append(node);this.nodes.set(text.id,node)}const style=textStyle(text);node.textContent=String(text.text??'').slice(0,2000);node.style.fontFamily=fontFamily(style.font);node.style.fontWeight=style.weight;node.style.textAlign=style.align;node.style.color=style.color;node.style.webkitTextStroke='';node.style.lineHeight=style.lineHeight;node.style.background=style.box==='light'?'#f6f7efd1':style.box==='dark'?'#0508069e':'';node.style.padding=style.box==='none'?'0':'.22em .3em';node.style.borderRadius=style.box==='none'?'0':'.12em'}
 }
 update(texts,time,scale){this.sync(texts);for(const text of texts){const node=this.nodes.get(text.id),pose=textPose(text,time),style=textStyle(text);node.hidden=!pose.alpha;if(!pose.alpha)continue;node.style.left=pose.x*100+'%';node.style.top=pose.y*100+'%';const layout=JSON.stringify([text.text,text.size,style,scale,this.root.clientWidth,this.root.clientHeight]);if(node.dataset.layout!==layout){node.dataset.layout=layout;node.style.fontSize=Math.max(1,(+text.size||48)*scale)+'px';node.style.letterSpacing=style.letterSpacing*scale+'px';node.style.webkitTextStroke='';const fit=Math.min(1,this.root.clientWidth*.92/Math.max(1,node.scrollWidth),this.root.clientHeight*.9/Math.max(1,node.scrollHeight));node.dataset.fit=String(fit)}const base=style.align==='left'?'translate(0,-50%)':style.align==='right'?'translate(-100%,-50%)':'translate(-50%,-50%)';node.style.opacity=pose.alpha;node.style.transform=`${base} scale(${node.dataset.fit||1})`;node.style.transformOrigin=style.align==='left'?'left center':style.align==='right'?'right center':'center'}}
 clear(){for(const node of this.nodes.values())node.remove();this.nodes.clear();this.signature=''}
}

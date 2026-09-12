import {textPose} from './creative.js';

const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#ffffff';
export function textStyle(text={}){return{
 font:['Sans','Serif','Mono'].includes(text.font)?text.font:'Sans',
 align:['left','center','right'].includes(text.align)?text.align:'center',
 weight:[400,500,600,700,800].includes(+text.weight)?+text.weight:600,
 color:color(text.color),outline:Math.max(0,Math.min(8,+text.outline||0)),
 box:['none','dark','light'].includes(text.box)?text.box:'none'
}}
export const fontFamily=font=>font==='Serif'?'Georgia, "Times New Roman", serif':font==='Mono'?'"SFMono-Regular", Menlo, monospace':'Arial, "Hiragino Sans", sans-serif';
const lines=text=>String(text.text??'').slice(0,2000).split('\n').slice(0,20);
function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
export function drawTextCanvas(ctx,text,time,w,h){
 const pose=textPose(text,time);if(!pose.alpha)return false;const style=textStyle(text),rows=lines(text),size=Math.max(1,Math.min((+text.size||48)*h/1080,h*.9/(rows.length*1.12))),lineHeight=size*1.12,maxWidth=w*.92;
 ctx.save();ctx.globalAlpha=pose.alpha;ctx.font=`${style.weight} ${size}px ${fontFamily(style.font)}`;ctx.textAlign=style.align;ctx.textBaseline='middle';ctx.lineJoin='round';
 const x=pose.x*w,y=pose.y*h,width=Math.min(maxWidth,Math.max(...rows.map(line=>ctx.measureText(line||' ').width),1)),height=Math.max(lineHeight,rows.length*lineHeight),left=style.align==='left'?x:style.align==='right'?x-width:x-width/2;
 if(style.box!=='none'){const pad=size*.24;ctx.fillStyle=style.box==='light'?'rgba(246,247,239,.82)':'rgba(5,8,6,.62)';roundRect(ctx,left-pad,y-height/2-pad,width+pad*2,height+pad*2,size*.12);ctx.fill()}
 rows.forEach((line,index)=>{const ly=y+(index-(rows.length-1)/2)*lineHeight;if(style.outline){ctx.strokeStyle=style.box==='light'?'rgba(255,255,255,.76)':'rgba(0,0,0,.78)';ctx.lineWidth=style.outline*2*h/1080;ctx.strokeText(line,x,ly,maxWidth)}ctx.fillStyle=style.color;ctx.fillText(line,x,ly,maxWidth)});
 ctx.restore();return true;
}
export function rasterizeText(text){
 const style=textStyle(text),rows=lines(text),size=Math.max(8,Math.min(300,+text.size||48,1080*.84/(rows.length*1.12))),probe=document.createElement('canvas').getContext('2d');probe.font=`${style.weight} ${size}px ${fontFamily(style.font)}`;
 const maxWidth=1920*.88,lineHeight=size*1.12,pad=Math.ceil(size*.3+style.outline*2),width=Math.max(2,Math.ceil(Math.min(maxWidth,Math.max(...rows.map(line=>probe.measureText(line||' ').width),1))+pad*2)),height=Math.max(2,Math.ceil(rows.length*lineHeight+pad*2));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.font=`${style.weight} ${size}px ${fontFamily(style.font)}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 if(style.box!=='none'){ctx.fillStyle=style.box==='light'?'rgba(246,247,239,.82)':'rgba(5,8,6,.62)';roundRect(ctx,0,0,width,height,size*.12);ctx.fill()}
 rows.forEach((line,index)=>{const y=height/2+(index-(rows.length-1)/2)*lineHeight;if(style.outline){ctx.strokeStyle=style.box==='light'?'rgba(255,255,255,.76)':'rgba(0,0,0,.78)';ctx.lineWidth=style.outline*2;ctx.strokeText(line,width/2,y,maxWidth)}ctx.fillStyle=style.color;ctx.fillText(line,width/2,y,maxWidth)});
 return{data:canvas.toDataURL('image/png'),width,height};
}
export function withTextRasters(project){const copy=structuredClone(project);copy.texts=copy.texts.map(text=>({...text,raster:rasterizeText(text)}));return copy}

export class TextPreview{
 constructor(root){this.root=root;this.nodes=new Map();this.signature=''}
 sync(texts){const signature=texts.map(t=>JSON.stringify([t.id,t.text,textStyle(t)])).join('|');if(signature===this.signature)return;this.signature=signature;const wanted=new Set(texts.map(t=>t.id));for(const[id,node]of this.nodes)if(!wanted.has(id)){node.remove();this.nodes.delete(id)}
  for(const text of texts){let node=this.nodes.get(text.id);if(!node){node=document.createElement('div');node.className='text-item';this.root.append(node);this.nodes.set(text.id,node)}const style=textStyle(text);node.textContent=String(text.text??'').slice(0,2000);node.style.fontFamily=fontFamily(style.font);node.style.fontWeight=style.weight;node.style.textAlign=style.align;node.style.color=style.color;node.style.webkitTextStroke=style.outline?`${style.outline}px ${style.box==='light'?'#fff9':'#000c'}`:'';node.style.background=style.box==='light'?'#f6f7efd1':style.box==='dark'?'#0508069e':'';node.style.padding=style.box==='none'?'0':'.22em .3em';node.style.borderRadius=style.box==='none'?'0':'.12em'}
 }
 update(texts,time,scale){this.sync(texts);for(const text of texts){const node=this.nodes.get(text.id),pose=textPose(text,time),style=textStyle(text);node.hidden=!pose.alpha;if(!pose.alpha)continue;node.style.left=pose.x*100+'%';node.style.top=pose.y*100+'%';const layout=JSON.stringify([text.text,text.size,style,scale,this.root.clientWidth,this.root.clientHeight]);if(node.dataset.layout!==layout){node.dataset.layout=layout;node.style.fontSize=Math.max(1,(+text.size||48)*scale)+'px';node.style.webkitTextStroke=style.outline?`${style.outline*scale}px ${style.box==='light'?'#fff9':'#000c'}`:'';const fit=Math.min(1,this.root.clientWidth*.92/Math.max(1,node.scrollWidth),this.root.clientHeight*.9/Math.max(1,node.scrollHeight));node.dataset.fit=String(fit)}const base=style.align==='left'?'translate(0,-50%)':style.align==='right'?'translate(-100%,-50%)':'translate(-50%,-50%)';node.style.opacity=pose.alpha;node.style.transform=`${base} scale(${node.dataset.fit||1})`;node.style.transformOrigin=style.align==='left'?'left center':style.align==='right'?'right center':'center'}}
 clear(){for(const node of this.nodes.values())node.remove();this.nodes.clear();this.signature=''}
}

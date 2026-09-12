export const attributeGroups={color:['color','lookName','lookAmount'],crop:['scale','x','y'],motion:['speed','endSpeed','curve','stabilization','interpolation'],visual:['opacity','fadeIn','fadeOut'],audio:['audio']};
export function pasteAttributes(target,source,groups){
 if(!target||!source)return false;
 let changed=false;
 for(const group of groups){
  if(group!=='audio'&&(target.kind==='audio'||source.kind==='audio'))continue;
  if(group==='motion'&&(target.freezeAt!=null||source.freezeAt!=null||target.kind==='image'||source.kind==='image'))continue;
  for(const key of attributeGroups[group]||[]){
   if(Object.hasOwn(source,key)){target[key]=structuredClone(source[key]);changed=true}
   else if(Object.hasOwn(target,key)){delete target[key];changed=true}
  }
  if(group==='motion')delete target.timingBase;
 }
 return changed;
}

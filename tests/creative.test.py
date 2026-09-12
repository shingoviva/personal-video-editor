import os,sys,pathlib,tempfile,subprocess,copy
with tempfile.TemporaryDirectory(prefix='pve-creative-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'));import core
 def source(name,color):
  path=pathlib.Path(tmp)/(name+'.mp4')
  subprocess.run(core.BASE+['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p',path],check=True,capture_output=True)
  return core.inspect(path,name,path.name)
 red=source('red','red');blue=source('blue','blue')
 def clip(m,layer):return {'id':m['id'],'media':m['id'],'in':0,'out':2,'start':0,'layer':layer,'speed':1,'endSpeed':1,'curve':'constant','audio':{'volume':0},'color':{},'stabilization':'OFF'}
 p={'version':1,'media':[red,blue],'clips':[clip(red,0),{**clip(blue,1),'fadeIn':1,'fadeOut':1}],'bgm':{},'texts':[],'aspect':'Original','export':{'fps':'30','resolution':'Source','quality':'High'}}
 def render(p,name):
  r=core.render({'id':name,'cancel':False},p);out=core.ROOT/'exports'/r['file'];core.validate_output(out,2,True);return out
 def pixel(out,t):
  return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 out=render(p,'fade')
 a,b,c=pixel(out,0),pixel(out,.5),pixel(out,1)
 assert a[0]>200 and a[2]<30,(a,b,c)
 assert b[0]>80 and b[2]>80,(a,b,c)
 assert c[2]>200 and c[0]<30,(a,b,c)
 q=copy.deepcopy(p);q['clips']=q['clips'][:1];q['effects']=[{'type':'flash','start':0,'duration':.4,'strength':1},{'type':'black-in','start':.5,'duration':.4,'strength':1},{'type':'black-out','start':1,'duration':1,'strength':1}]
 out=render(q,'effects')
 assert min(pixel(out,0))>220,pixel(out,0)
 assert max(pixel(out,.5))<25,pixel(out,.5)
 assert pixel(out,.9)[0]>200,pixel(out,.9)
 assert max(pixel(out,1.9))<40,pixel(out,1.9)
 q['effects']=[];q['clips'][0].update(freezeAt=.5,freezeDuration=2,**{'in':.5,'out':.5+1/30})
 q['texts']=[{'text':'STILL','start':0,'end':2,'fadeIn':.3,'fadeOut':.4,'motion':'rise','motionDuration':.4,'size':80}] if core.capabilities().get('text') else []
 render(q,'freeze-text')
 moving=core.inspect(root/'dist/device-test.mp4','moving','device-test.mp4')
 q['clips']=[{**clip(moving,0),'in':.999,'out':1,'freezeAt':.999,'freezeDuration':2}];q['texts']=[]
 out=render(q,'last-frame')
 def raw(t):return subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
 first,last=raw(.3),raw(1.5);delta=[abs(a-b) for a,b in zip(first,last)]
 assert sum(delta)/len(delta)<2 and max(delta)<16,('Frozen frame changed',sum(delta)/len(delta),max(delta))
 from color_engine import grade
 q['clips']=[clip(red,0)];q['clips'][0]['color']={'temperature':-40,'contrast':28,'saturation':-18}
 out=render(q,'look');actual=pixel(out,.5);expected=grade([253/255,0,0],q['clips'][0]['color'])
 assert max(abs(a-v*255) for a,v in zip(actual,expected))<15,(actual,expected)
 print('Native V2 alpha reveals V1, flash, black fades, freeze, last moving frame held, RGB LUT output: full MP4 decode PASS; text:', 'PASS' if core.capabilities().get('text') else 'SKIP (drawtext unavailable)')

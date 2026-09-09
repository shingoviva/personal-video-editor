import os,sys,pathlib,tempfile,subprocess,copy,array,math
with tempfile.TemporaryDirectory(prefix='pve-multitrack-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(root/'engine'));import core
 def video(name,color):
  path=pathlib.Path(tmp)/(name+'.mp4');subprocess.run(core.BASE+['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p',path],capture_output=True,check=True);return core.inspect(path,name,path.name)
 def sound(name,freq):
  path=pathlib.Path(tmp)/(name+'.wav');subprocess.run(core.BASE+['-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000:duration=1','-c:a','pcm_s16le',path],capture_output=True,check=True);return core.inspect(path,name,path.name)
 def clip(m,layer):return {'id':m['id'],'media':m['id'],'in':0,'out':2,'start':0,'layer':layer,'speed':1,'endSpeed':1,'curve':'constant','stabilization':'OFF','audio':{'volume':.4,'mute':False},'color':{}}
 media=[video('red','red'),video('blue','blue'),video('green','green')]+[sound('tone'+str(k),f) for k,f in enumerate([440,660,880,1100])]
 p={'version':1,'media':media,'clips':[clip(m,i) for i,m in enumerate(media[:3])],'audioClips':[{**clip(m,i),'kind':'audio','out':1.5,'start':i*.1,'loop':True} for i,m in enumerate(media[3:])],'audioTracks':[{} for _ in range(4)],'texts':[],'bgm':{},'aspect':'Original','export':{'resolution':'Source','fps':'30','quality':'High'}}
 p['clips'][1]['opacity']=.5;p['clips'][2]['opacity']=.5
 def render(p,name):
  r=core.render({'id':name,'cancel':False},copy.deepcopy(p));out=core.ROOT/'exports'/r['file'];core.validate_output(out,r['duration'],True);return out,r
 def amplitudes(out):
  raw=subprocess.check_output(core.BASE+['-v','error','-ss','0.7','-i',out,'-t','0.2','-vn','-ac','1','-ar','8000','-f','f32le','pipe:1']);samples=array.array('f');samples.frombytes(raw)
  return [2*abs(sum(v*complex(math.cos(2*math.pi*f*i/8000),math.sin(2*math.pi*f*i/8000)) for i,v in enumerate(samples)))/len(samples) for f in [440,660,880,1100]]
 out,r=render(p,'four-tracks');rgb=list(subprocess.check_output(core.BASE+['-v','error','-ss','0.7','-i',out,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']));assert min(rgb)>35,rgb
 amps=amplitudes(out);assert min(amps)>.02,amps
 p['audioTracks'][2]['solo']=True;p['audioClips'][2]['out']=2.5
 out,r=render(p,'solo-tail');assert abs(r['duration']-2.7)<.04,r
 amps=amplitudes(out);assert amps[2]>.02 and max(amps[:2]+amps[3:])<.004,amps
 print('Native three translucent video layers, four independent tones/loops, solo, audio extends black tail, H264/AAC full decode PASS')

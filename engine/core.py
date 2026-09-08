"""Bounded-memory, non-destructive native media pipeline. Python standard library only."""
import array, bisect, collections, hashlib, json, math, os, pathlib, shutil, statistics, subprocess, threading, time, uuid, struct, zlib
ROOT=pathlib.Path(os.environ.get('PVE_DATA',str(pathlib.Path.home()/'Library/Application Support/Personal Video Editor')))
ROOT.mkdir(parents=True,exist_ok=True)
for name in ('media','cache','exports','projects'): (ROOT/name).mkdir(exist_ok=True)
FFMPEG=shutil.which('ffmpeg'); FFPROBE=shutil.which('ffprobe')
BASE=[FFMPEG or 'ffmpeg','-hide_banner','-loglevel','warning','-nostdin','-y','-threads','2','-filter_threads','2','-filter_complex_threads','2']
JOBS={}; MEDIA={}; GATE=threading.Lock()
for f in (ROOT/'media').glob('*.json'):
 try: MEDIA[f.stem]=json.loads(f.read_text())
 except Exception: pass

def number(v,default=0,lo=-1e9,hi=1e9):
 try: n=float(v); return max(lo,min(hi,n)) if math.isfinite(n) else default
 except (ValueError,TypeError): return default

def ratio(s):
 try:
  a,b=str(s).split('/');return float(a)/float(b)
 except Exception:return number(s,30)

def capabilities():
 if not FFMPEG or not FFPROBE:return {'ready':False,'error':'FFmpeg / ffprobe をインストールしてください。'}
 f=subprocess.run([FFMPEG,'-hide_banner','-filters'],capture_output=True,text=True).stdout
 e=subprocess.run([FFMPEG,'-hide_banner','-encoders'],capture_output=True,text=True).stdout
 return {'ready':'libx264' in e,'stabilization':'vidstabtransform' in f,'hdr':'zscale' in f and 'tonemap' in f,'text':'drawtext' in f,'videotoolbox':'h264_videotoolbox' in e,'engine':'Native FFmpeg','version':subprocess.run([FFMPEG,'-version'],capture_output=True,text=True).stdout.splitlines()[0]}

def inspect(path,id,name):
 r=subprocess.run([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,timeout=90)
 if r.returncode:raise ValueError(r.stderr[-1000:])
 d=json.loads(r.stdout);v=next((s for s in d['streams'] if s['codec_type']=='video'),None);a=next((s for s in d['streams'] if s['codec_type']=='audio'),None)
 if not v and not a:raise ValueError('映像・音声ストリームが見つかりません。')
 v=v or {}; fmt=d.get('format',{});rotation=0
 for s in v.get('side_data_list',[]):rotation=s.get('rotation',rotation)
 w,h=v.get('width',0),v.get('height',0)
 if abs(rotation)%180==90:w,h=h,w
 trc=v.get('color_transfer','unknown');dolby=next((s for s in v.get('side_data_list',[]) if 'DOVI' in s.get('side_data_type','')),None)
 m={'id':id,'name':name,'path':str(path),'width':w,'height':h,'duration':number(fmt.get('duration',v.get('duration')),0,0), 'fps':ratio(v.get('avg_frame_rate','30/1')) or 30,'rateMode':'Checking' if w else '—','codec':v.get('codec_name',a.get('codec_name') if a else 'unknown'),'container':fmt.get('format_name',''),'size':path.stat().st_size,'audio':bool(a),'hdr':trc in ('smpte2084','arib-std-b67') or bool(dolby),'transfer':trc,'primaries':v.get('color_primaries','unknown'),'matrix':v.get('color_space','unknown'),'dolby':dolby,'rotation':rotation,'proxy':None}
 save_media(m);return m

def save_media(m):
 MEDIA[m['id']]=m;p=ROOT/'media'/f"{m['id']}.json";tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(m));tmp.replace(p)

def public_media(m):return {k:v for k,v in m.items() if k!='path'}

def check(job):
 if job.get('cancel'):raise InterruptedError('処理をキャンセルしました。')

def run(job,args,duration=1,start=0,span=1,cwd=None):
 check(job);log=collections.deque(maxlen=32)
 proc=subprocess.Popen(BASE+['-progress','pipe:1','-nostats']+list(map(str,args)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,cwd=cwd)
 job['_proc']=proc
 def stderr():
  for line in proc.stderr:log.append(line)
 t=threading.Thread(target=stderr,daemon=True);t.start()
 try:
  for line in proc.stdout:
   check(job)
   if line.startswith('out_time_us='):
    value=number(line.split('=')[1])/1e6
    job['progress']=min(.999,start+span*max(0,min(1,value/max(.001,duration))))
  code=proc.wait();t.join();check(job)
  if code:raise RuntimeError(''.join(log)[-2200:])
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
  proc.stdout.close();proc.stderr.close();job.pop('_proc',None)

def submit(kind,fn,*args):
 id=uuid.uuid4().hex;j={'id':id,'kind':kind,'status':'queued','progress':0,'operation':'待機中','cancel':False};JOBS[id]=j
 def work():
  with GATE:
   try:
    check(j);j['status']='running';j['result']=fn(j,*args);j['status']='done';j['progress']=1
   except InterruptedError as e:j.update(status='cancelled',error=str(e))
   except Exception as e:j.update(status='error',error=str(e))
   finally:
    j.pop('_proc',None)
    # Job history has a fixed upper bound; files stay on disk until explicit cleanup.
    finished=[k for k,v in JOBS.items() if v['status'] in ('done','error','cancelled')]
    for k in finished[:-30]:JOBS.pop(k,None)
 threading.Thread(target=work,daemon=True).start();return id

def cancel(id):
 j=JOBS[id];j['cancel']=True;p=j.get('_proc')
 if p and p.poll() is None:p.terminate()

def tone(m,small=None):
 vf=[]
 if m['hdr']:
  dv=m.get('dolby') or {}
  if dv.get('dv_profile')==5:raise ValueError('Dolby Vision Profile 5 はV1のSDR変換対象外です。AppleでSDRへ変換した素材を再読み込みしてください。')
  if m.get('transfer') not in ('smpte2084','arib-std-b67'):raise ValueError('HDR伝達関数が不明です。誤った色で変換しないため処理を停止しました。')
  resize=f'w={small}:h=-2:' if small else ''
  vf=[f'zscale={resize}t=linear:npl=100','format=gbrpf32le','zscale=p=bt709','tonemap=hable:desat=0','zscale=t=bt709:m=bt709:r=tv','format=yuv420p']
 elif small:vf=[f"scale='min({small},iw)':-2"]
 return vf

def prepare(job,id):
 m=MEDIA[id];job['operation']='素材を解析中';path=m['path']
 if not m['width']:return public_media(m)
 # Streaming PTS inspection: full file, O(1) working storage. Avoid accumulating frame arrays.
 p=subprocess.Popen([FFPROBE,'-v','error','-select_streams','v:0','-show_entries','packet=pts_time','-of','csv=p=0',path],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True);job['_proc']=p
 prev=None;deltas=set();count=0
 try:
  # Packet reordering is accounted for by a tiny reorder window.
  window=[]
  def consume(x):
   nonlocal prev,count
   if prev is not None and x>prev:deltas.add(round(x-prev,4))
   prev=x;count+=1
  import heapq
  for line in p.stdout:
   check(job)
   try:x=float(line.strip().split(',')[0])
   except ValueError:continue
   heapq.heappush(window,x)
   if len(window)>32:consume(heapq.heappop(window))
   if len(deltas)>10:break
  while window:consume(heapq.heappop(window))
 finally:
  if p.poll() is None:p.terminate()
  p.wait();p.stdout.close();job.pop('_proc',None)
 # Small timestamp quantization differences do not imply VFR.
 m['rateMode']='VFR' if deltas and max(deltas)-min(deltas)>.001 else 'CFR';save_media(m)
 out=ROOT/'cache'/f'{id}-proxy.mp4';job['operation']='SDRプロキシを生成中' if m['hdr'] else '720pプロキシを生成中'
 if not out.exists():
  vf=tone(m,1280)+["scale=w='if(gte(iw,ih),min(iw,1280),-2)':h='if(gte(iw,ih),-2,min(ih,720))'",'fps=30','setsar=1']
  temp=out.with_name(out.stem+'.part.mp4')
  run(job,['-i',path,'-map','0:v:0','-map','0:a:0?','-vf',','.join(vf),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','128k','-movflags','+faststart',temp],m['duration'],0,.86)
  temp.replace(out)
 m['proxy']=out.name;save_media(m)
 job['operation']='サムネイルを作成中'
 for i in range(8):
  f=ROOT/'cache'/f'{id}-thumb-{i}.jpg'
  if not f.exists():run(job,['-ss',max(0,m['duration']*(i+.5)/8),'-i',out,'-frames:v','1','-vf','scale=160:-2','-update','1',f],1,.86+i*.012,.012)
 if m['audio']:
  job['operation']='音声波形を作成中';f=ROOT/'cache'/f'{id}-wave.png'
  if not f.exists():waveform(job,out,f,m['duration'])
 return public_media(m)

def waveform(job,source,out,duration):
 width,height=1200,80;peaks=[0]*width;index=0;rate=8000;expected=max(1,duration*rate)
 proc=subprocess.Popen(BASE+['-v','error','-i',str(source),'-vn','-ac','1','-ar',str(rate),'-f','s16le','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL);job['_proc']=proc
 try:
  while True:
   check(job);b=proc.stdout.read(8192)
   if not b:break
   samples=array.array('h');samples.frombytes(b)
   for v in samples:
    bucket=min(width-1,int(index/expected*width));peaks[bucket]=max(peaks[bucket],abs(v));index+=1
   job['progress']=min(.999,.96+.039*index/expected)
  if proc.wait():raise ValueError('音声波形を生成できませんでした。')
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
  proc.stdout.close();job.pop('_proc',None)
 rows=bytearray()
 for y in range(height):
  rows.append(0)
  for x in range(width):
   on=abs(y-height/2)<=max(1,peaks[x]/32768*(height/2-2));rows.extend((155,173,169,220) if on else (0,0,0,0))
 def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
 out.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(rows)))+chunk(b'IEND',b''))

def curve_value(t,a,b,kind):
 if kind=='constant':return a
 if kind=='ease-in':t=t*t
 elif kind=='ease-out':t=1-(1-t)**2
 elif kind=='ease-in-out':t=t*t*(3-2*t)
 return a+(b-a)*t

def timing(c):
 
 if c.get('gap'):
  d=number(c['gap'],1,.01,86400);return [(0,0),(d,d)],[(0,d,1,d)]
 d=c['out']-c['in'];a=number(c.get('speed'),1,.05,20);b=number(c.get('endSpeed'),a,.05,20);kind=c.get('curve','constant')
 n=1 if kind=='constant' or a==b else 32
 nodes=[(0,0)];pieces=[];elapsed=0
 for i in range(n):
  x=d*i/n;y=d*(i+1)/n;s=curve_value((i+.5)/n,a,b,kind);length=(y-x)/s
  pieces.append((x,y,s,length));elapsed+=length;nodes.append((y,elapsed))
 return nodes,pieces

def validate(project):
 if project.get('version')!=1:raise ValueError('対応していないプロジェクト形式です。')
 clips=project.get('clips',[])
 if not clips or len(clips)>200:raise ValueError('クリップ数は1〜200です。')
 for c in clips:
  if c.get('gap'):
   c['gap']=number(c['gap'],1,.01,86400);continue
  if c.get('media') not in MEDIA:raise ValueError('元素材を再リンクしてください。')
  m=MEDIA[c['media']]
  if not m['width']:raise ValueError('動画素材を選択してください。')
  c['in']=number(c.get('in'),0,0,m['duration']);c['out']=number(c.get('out'),m['duration'],0,m['duration'])
  if c['out']-c['in']<.001:raise ValueError('IN / OUT の範囲が無効です。')
 return clips

def output_size(project,m,preview=False):
 r=project.get('aspect','Original');ratios={'9:16':9/16,'4:5':.8,'1:1':1,'16:9':16/9};ar=ratios.get(r,m['width']/m['height']);res=project.get('export',{}).get('resolution','1080p')
 short=540 if preview else 2160 if res=='4K' else min(m['width'],m['height']) if res=='Source' else 1080
 return (max(2,round((short*ar if ar>=1 else short)/2)*2),max(2,round((short if ar>=1 else short/ar)/2)*2))

def atempo(speed):
 filters=[]
 while speed<.5:filters.append('atempo=0.5');speed/=.5
 while speed>2:filters.append('atempo=2');speed/=2
 filters.append(f'atempo={speed:.9f}');return ','.join(filters)

def color_filters(col):
 e=number(col.get('exposure'),0,-3,3);con=number(col.get('contrast'),0,-100,100);sat=number(col.get('saturation'),0,-100,100);vib=number(col.get('vibrance'),0,-100,100)
 # Exposure is linear RGB gain; controls use bounded tonal masks on each RGB channel.
 hi=number(col.get('highlights'),0,-100,100)/400;sh=number(col.get('shadows'),0,-100,100)/400;wh=number(col.get('whites'),0,-100,100)/500;bl=number(col.get('blacks'),0,-100,100)/500;temp=number(col.get('temperature'),0,-100,100)/400;tint=number(col.get('tint'),0,-100,100)/400
 gain=2**e;cf=1+con/150
 common=f'clip((val/255*{gain}-.5)*{cf}+.5+{sh}*(1-val/255)^2+{hi}*(val/255)^2+{wh}*(val/255)^4+{bl}*(1-val/255)^4'
 rgb=[]
 for k,bias in [('r',temp+tint/2),('g',-tint),('b',-temp+tint/2)]:rgb.append(f"{k}='255*{common}+{bias},0,1)'")
 return ['format=rgb24','lutrgb='+':'.join(rgb),f'eq=saturation={1+sat/100}',f'vibrance=intensity={vib/100}']

def render(job,project,preview=False):
 clips=validate(project);first=next((MEDIA[c['media']] for c in clips if c.get('media') in MEDIA),{'width':1920,'height':1080,'fps':30});w,h=output_size(project,first,preview);exp=project.get('export',{});fps=number(exp.get('fps'),first['fps'] if exp.get('fps')=='Source' else 30,1,240)
 if preview:fps=min(30,fps)
 fps=min(60,fps) # SNS V1 delivery contract
 crf={'Preview':28,'Standard':21,'High':18,'Maximum':15}.get(exp.get('quality'),21)
 work=ROOT/'cache'/('render-'+job['id']);work.mkdir();outputs=[];total=sum(timing(c)[0][-1][1]+(0 if c.get('gap') else number(c.get('hold'),0,0,10)) for c in clips);done=0
 try:
  for idx,c in enumerate(clips):
   if c.get('gap'):
    d=number(c['gap'],1,.01,86400);part=work/f'clip-{idx:04d}.mp4';outputs.append(part);job['operation']='空白区間を生成中'
    run(job,['-f','lavfi','-i',f'color=c=black:s={w}x{h}:r={fps}','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',d,'-c:v','libx264','-preset','veryfast','-threads','2','-crf',crf,'-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-video_track_timescale','90000',part],d,done/max(total,.001)*.85,d/max(total,.001)*.85)
    done+=d;continue
   check(job);m=MEDIA[c['media']];nodes,pieces=timing(c);duration=nodes[-1][1];hold=number(c.get('hold'),0,0,10);vf=tone(m);source=m['path'];source_duration=c['out']-c['in'];seek=c['in'];job['operation']=f'クリップ {idx+1}/{len(clips)} を処理中'
   stabil=c.get('stabilization','OFF')
   if stabil!='OFF':
    if not capabilities()['stabilization']:raise ValueError('このFFmpegにはvidstabがありません。libvidstab対応版が必要です。')
    # Stabilize before time remapping. Each selected source segment is streamed to disk, not RAM.
    trf='motion.trf';pre=work/'stabilized.mp4';smooth={'WEAK':5,'MEDIUM':15,'STRONG':30,'HANDHELD':3,'NATURAL':10,'GIMBAL':25,'TRIPOD':60}.get(stabil,15)
    job['operation']=f'手ぶれの解析 {idx+1}/{len(clips)}'
    run(job,['-ss',seek,'-i',source,'-t',source_duration,'-an','-vf',','.join(vf+[f'vidstabdetect=shakiness=5:accuracy=9:result={trf}']),'-f','null','-'],source_duration,done/max(total,.001)*.85,.02,cwd=work)
    job['operation']='手ぶれを補正中'
    run(job,['-ss',seek,'-i',source,'-t',source_duration,'-vf',','.join(vf+[f'vidstabtransform=input={trf}:smoothing={smooth}:optzoom=1:crop=black','format=yuv420p']),'-c:v','libx264','-preset','veryfast','-crf','16','-threads','2','-c:a','aac',pre],source_duration,done/max(total,.001)*.85,.03,cwd=work)
    source=str(pre);seek=0;vf=[]
   scale=number(c.get('scale'),1,1,3);x=number(c.get('x'),.5,0,1);y=number(c.get('y'),.5,0,1);ar=w/h
   vf.extend([f"crop=w='trunc(min(iw,ih*{ar})/{scale}/2)*2':h='trunc(min(ih,iw/{ar})/{scale}/2)*2':x='(iw-ow)*{x}':y='(ih-oh)*{y}'",f'scale={w}:{h}:flags=lanczos','setsar=1'])
   vf+=color_filters(c.get('color',{}));vf+=['settb=AVTB','setpts=PTS-STARTPTS']
   # Use the same 32-piece integral as the browser timeline. Source PTS handles VFR.
   expr=f'{duration:.9f}'
   for (x0,y0),(x1,y1) in reversed(list(zip(nodes,nodes[1:]))):expr=f'if(lt(T,{x1:.9f}),{y0:.9f}+(T-{x0:.9f})*{(y1-y0)/(x1-x0):.9f},{expr})'
   vf.append(f"setpts='{expr}/TB'")
   if c.get('interpolation')=='blend':vf.append(f'framerate=fps={fps}:interp_start=0:interp_end=255:scene=100')
   else:vf.append(f'fps={fps}')
   vf+=['fps='+str(fps),'tpad=stop_mode=clone:stop=-1',f'trim=duration={duration+hold}','format=yuv420p']
   graph=['[0:v]'+','.join(vf)+'[v]'];audio=c.get('audio',{});volume=number(audio.get('volume'),1,0,2) if not audio.get('mute') else 0
   input_args=['-ss',seek,'-t',source_duration,'-i',source]
   if m['audio'] and len(pieces)>1:
    # Render ramp audio pieces sequentially to disk. No full-length asplit queues in RAM.
    audio_parts=[]
    for k,(a,b,s,length) in enumerate(pieces):
     ap=work/f'audio-{k:03d}.wav';audio_parts.append(ap)
     af=f'atrim=duration={b-a},asetpts=PTS-STARTPTS,apad=pad_dur=1,{atempo(s)},apad,atrim=duration={length},asetpts=N/SR/TB'
     run(job,['-ss',seek+a,'-i',source,'-vn','-af',af,'-c:a','pcm_s16le','-ar','48000','-ac','2',ap],length,done/max(total,.001)*.85,0)
    alist=work/'audio-concat.txt';alist.write_text(''.join(f"file '{p.name}'\n" for p in audio_parts));audio_ramp=work/'ramp.wav'
    run(job,['-f','concat','-safe','0','-i',alist,'-c','copy',audio_ramp],duration,done/max(total,.001)*.85,0)
    input_args+=['-i',audio_ramp]
    graph.append(f'[1:a]volume={volume},apad,atrim=duration={duration+hold},asetpts=N/SR/TB[mix]')
   elif m['audio']:
    s=pieces[0][2]
    graph.append(f'[0:a]asetpts=PTS-STARTPTS,apad=pad_dur=1,{atempo(s)},volume={volume},apad,atrim=duration={duration+hold},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=N/SR/TB[mix]')
   else:graph.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={duration+hold}[mix]')
   fadein=number(audio.get('fadeIn'),0,0,duration/2);fadeout=number(audio.get('fadeOut'),0,0,duration/2)
   graph.append(f'[mix]afade=t=in:d={max(.001,fadein)},afade=t=out:st={max(0,duration+hold-fadeout)}:d={max(.001,fadeout)}[a]')
   part=work/f'clip-{idx:04d}.mp4';outputs.append(part)
   script=work/'graph.txt';script.write_text(';\n'.join(graph))
   run(job,input_args+['-filter_complex_script',script,'-map','[v]','-map','[a]','-c:v','libx264','-preset','veryfast' if preview else 'fast','-threads','2','-crf',crf,'-c:a','aac','-b:a','192k','-ar','48000','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-video_track_timescale','90000',part],duration+hold,done/max(total,.001)*.85,(duration+hold)/max(total,.001)*.85)
   done+=duration+hold
   if (work/'stabilized.mp4').exists():(work/'stabilized.mp4').unlink()
  concat=work/'concat.txt';concat.write_text(''.join(f"file '{p.name}'\n" for p in outputs));joined=work/'joined.mp4'
  job['operation']='クリップを結合中';run(job,['-f','concat','-safe','0','-i',concat,'-c','copy',joined],total,.85,.04)
  out=ROOT/('cache' if preview else 'exports')/(job['id']+'.mp4');bgm=project.get('bgm',{});texts=project.get('texts',[]);final_vf=[]
  if len(texts)>20:raise ValueError('テキストは最大20個です。')
  for i,t in enumerate(texts):
   text=str(t.get('text',''))[:2000]
   if not text:continue
   txt=work/f'text-{i}.txt';txt.write_text(text,encoding='utf-8');size=number(t.get('size'),48,8,300)*h/1080;tx=number(t.get('x'),.5,0,1);ty=number(t.get('y'),.85,0,1);op=number(t.get('opacity'),1,0,1);a=number(t.get('start'),0,0,total);b=number(t.get('end'),total,0,total);fade=number(t.get('fade'),0,0,max(0,(b-a)/2));font={'Sans':'Arial','Serif':'Times New Roman','Mono':'Courier New'}.get(t.get('font'),'Arial');align=t.get('align','center');xp=f'w*{tx}' if align=='left' else f'w*{tx}-tw' if align=='right' else f'w*{tx}-tw/2'
   alpha=f"{op}*min(1,min((t-{a})/{max(.00001,fade)},({b}-t)/{max(.00001,fade)}))" if fade else str(op)
   final_vf.append(f"drawtext=textfile={txt}:expansion=none:font='{font}':fontcolor=white:fontsize={size}:x='{xp}':y='h*{ty}-th/2':alpha='{alpha}':enable='between(t,{a},{b})'")
  args=['-i',joined];bg=MEDIA.get(bgm.get('media'));graph=[]
  if bg:
   args+=['-stream_loop','-1','-i',bg['path']];vol=number(bgm.get('volume'),.3,0,2);fi=number(bgm.get('fadeIn'),0,0,total/2);fo=number(bgm.get('fadeOut'),0,0,total/2)
   graph=[f'[1:a]volume={vol},atrim=duration={total},afade=t=in:d={max(fi,.001)},afade=t=out:st={total-fo}:d={max(fo,.001)}[bg]','[0:a][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]'];args+=['-filter_complex',';'.join(graph),'-map','0:v','-map','[a]']
  if final_vf:args+=['-vf',','.join(final_vf),'-c:v','libx264','-preset','fast','-threads','2','-crf',crf]
  else:args+=['-c:v','copy']
  args+=['-c:a','aac' if bg else 'copy','-t',total,'-movflags','+faststart',out]
  job['operation']='MP4を仕上げ中';run(job,args,total,.89,.1)
  return {'file':out.name,'url':('/cache/' if preview else '/exports/')+out.name,'duration':total,'width':w,'height':h,'fps':fps,'preview':preview}
 finally:shutil.rmtree(work,ignore_errors=True)

def analyze(job,id,intent='HIGH FASHION'):
 m=MEDIA[id];src=ROOT/'cache'/m['proxy'] if m.get('proxy') else pathlib.Path(m['path']);fps=min(4,18000/max(m['duration'],1));w=h=64;n=w*h
 job['operation']='動き・静止・鮮鋭度を解析中'
 proc=subprocess.Popen(BASE+['-v','error','-i',str(src),'-an','-vf',f'fps={fps},scale={w}:{h},format=gray','-f','rawvideo','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL);job['_proc']=proc
 samples=[];prev=None
 try:
  while True:
   check(job);buf=bytearray()
   while len(buf)<n:
    chunk=proc.stdout.read(n-len(buf))
    if not chunk:break
    buf.extend(chunk)
   if len(buf)!=n:break
   gray=buf;motion=sum(abs(a-b) for a,b in zip(gray,prev))/n/255 if prev else 0;mean=sum(gray)/n/255
   sharp=sum(abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-w]-gray[i+w]) for i in range(w+1,n-w-1) if i%w not in (0,w-1))/(n*255)
   clipped=sum(v<5 or v>250 for v in gray)/n
   t=len(samples)/fps;samples.append({'time':round(t,3),'motion':round(motion,5),'sharpness':round(sharp,5),'exposure':round(mean,4),'clipping':round(clipped,4)})
   prev=gray;job['progress']=min(.98,t/max(m['duration'],.001))
  code=proc.wait();check(job)
  if code:raise ValueError('フレーム解析に失敗しました。')
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
  proc.stdout.close();job.pop('_proc',None)
 if not samples:raise ValueError('解析できるフレームがありません。')
 motion=[s['motion'] for s in samples];sharp=[s['sharpness'] for s in samples];med=statistics.median(motion);sm=max(sharp) or 1;mm=max(motion) or 1;markers=[]
 weight={'HIGH FASHION':.65,'RAW':.2,'CINEMATIC':.8,'CLUB':-.4,'DOCUMENTARY':.4}.get(intent,.65)
 ranked=sorted(samples,key=lambda s:s['sharpness']/sm-weight*s['motion']/mm-s['clipping']*.4,reverse=True)
 chosen=[]
 for s in ranked:
  if all(abs(s['time']-t)>2 for t in chosen):
   chosen.append(s['time']);markers.append({'time':s['time'],'type':'best','label':'BEST MOMENT','detail':'鮮鋭度・動き・白黒の飽和率から候補化'})
  if len(chosen)>=min(12,max(1,math.ceil(m['duration']/8))):break
 min_gap={'CLUB':.6,'HIGH FASHION':1.5,'DOCUMENTARY':4,'CINEMATIC':2,'RAW':3}.get(intent,2);last=-10
 for i,s in enumerate(samples[1:-1],1):
  if s['motion']>max(.012,med*1.5) and s['motion']>=motion[i-1] and s['motion']>motion[i+1] and s['time']-last>min_gap:
   markers.append({'time':s['time'],'type':'motion','label':'MOTION ACCENT','detail':'画面内の動きのピーク。被写体の種類は未分類。'});last=s['time']
 last=-10
 for i,s in enumerate(samples[2:-2],2):
  if s['motion']<max(.005,med*.5) and max(motion[i-2:i])>max(.015,med*1.3) and s['time']-last>min_gap:
   markers.append({'time':s['time'],'type':'still','label':'STILLNESS','detail':'動きの直後に静止する候補'});last=s['time']
 low=None;threshold=max(.003,min(.012,med*.4));minimum={'HIGH FASHION':5,'CLUB':1.5,'RAW':7,'DOCUMENTARY':8,'CINEMATIC':4}.get(intent,4)
 for i,s in enumerate(samples+[{'motion':1,'time':m['duration']}]):
  if s['motion']<threshold and low is None:low=s['time']
  elif s['motion']>=threshold and low is not None:
   if s['time']-low>=minimum:markers.append({'time':low,'end':s['time'],'type':'quiet','label':'LOW VISUAL CHANGE','detail':f"{s['time']-low:.1f} sec — 意図的な間は残せます。"})
   low=None
 result={'media':id,'intent':intent,'sampleFps':fps,'method':'低解像度フレームの鮮鋭度・輝度・差分解析。顔・視線・ポーズの認識は未実装。','markers':sorted(markers,key=lambda x:x['time'])[:250],'samples':samples}
 p=ROOT/'cache'/f'{id}-analysis.json';p.write_text(json.dumps(result));return result

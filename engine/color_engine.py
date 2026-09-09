"""Same RGB transform as preview.js; a cached 33-point LUT for native FFmpeg."""
import hashlib,json,pathlib
KEYS=('exposure','contrast','highlights','shadows','whites','blacks','temperature','tint','saturation','vibrance')
def grade(rgb,col,amount=1):
 c={k:float(col.get(k,0))*amount for k in KEYS};clip=lambda x:max(0.,min(1.,x))
 c['saturation']=max(-100,c['saturation'])
 bias=(c['temperature']/400+c['tint']/800,-c['tint']/400,-c['temperature']/400+c['tint']/800)
 v=[clip((x*2**c['exposure']-.5)*(1+c['contrast']/150)+.5+c['shadows']/400*(1-x)**2+c['highlights']/400*x*x+c['whites']/500*x**4+c['blacks']/500*(1-x)**4+bias[i]) for i,x in enumerate(rgb)]
 l=sum(a*b for a,b in zip(v,(.299,.587,.114)));v=[l+(x-l)*(1+c['saturation']/100) for x in v]
 f=1+c['vibrance']/100*(1-(max(v)-min(v)));return [clip(l+(x-l)*f) for x in v]
def filters(col,cache,amount=1):
 values={k:max(-3 if k=='exposure' else -100,min(3 if k=='exposure' else 100,float(col.get(k,0)))) for k in KEYS}
 if not any(values.values()) or amount==0:return []
 key=hashlib.sha256(json.dumps([values,amount],sort_keys=True).encode()).hexdigest()[:24]
 cache=pathlib.Path(cache);path=cache/('look-'+key+'.cube')
 if not path.exists():
  with path.with_suffix('.tmp').open('w') as f:
   f.write('LUT_3D_SIZE 33\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
   for b in range(33):
    for g in range(33):
     for r in range(33):f.write(' '.join(f'{v:.7f}' for v in grade((r/32,g/32,b/32),values,amount))+'\n')
  path.with_suffix('.tmp').replace(path)
  for old in sorted(cache.glob('look-*.cube'),key=lambda p:p.stat().st_mtime,reverse=True)[32:]:old.unlink(missing_ok=True)
 return [f"lut3d=file='{path}':interp=tetrahedral"]

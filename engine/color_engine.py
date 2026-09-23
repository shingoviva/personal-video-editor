"""Same RGB transform as preview.js; a cached 33-point LUT for native FFmpeg."""
import hashlib,json,pathlib
COLOR_KEYS=('exposure','brilliance','highlights','shadows','contrast','brightness','blackPoint','whites','blacks','gamma','temperature','warmth','tint','saturation','vibrance','fade')
CURVE_KEYS=('curveMaster','curveRed','curveGreen','curveBlue')
SPATIAL_KEYS=('sharpness','definition','noiseReduction','vignette')
KEYS=COLOR_KEYS+SPATIAL_KEYS
IDENTITY=(0.,.25,.5,.75,1.)
def normalize_curve(value):
 source=value if isinstance(value,list) else IDENTITY
 return [max(0.,min(1.,float(source[i]) if i<len(source) else IDENTITY[i])) for i in range(5)]
def curve_at(points,x):
 x=max(0.,min(1.,x))*4;i=min(3,int(x));t=x-i
 return points[i]+(points[i+1]-points[i])*t
def grade(rgb,col,amount=1):
 c={k:float(col.get(k,0))*amount for k in COLOR_KEYS};clip=lambda x:max(0.,min(1.,x))
 c['saturation']=max(-100,c['saturation'])
 curves={k:[IDENTITY[i]+(v-IDENTITY[i])*amount for i,v in enumerate(normalize_curve(col.get(k)))] for k in CURVE_KEYS}
 warm=c['temperature']+c['warmth']*.8;bias=(warm/400+c['tint']/800,-c['tint']/400,-warm/400+c['tint']/800)
 v=[clip((x*2**c['exposure']-.5)*(1+c['contrast']/150)+.5+c['brightness']/200+c['brilliance']/550*(1-abs(2*x-1))+c['shadows']/400*(1-x)**2+c['highlights']/400*x*x+c['whites']/500*x**4+c['blacks']/500*(1-x)**4-c['blackPoint']/180*(1-x)**3+bias[i]) for i,x in enumerate(rgb)]
 v=[x**(2**(-c['gamma']/100)) for x in v];v=[curve_at(curves[('curveRed','curveGreen','curveBlue')[i]],curve_at(curves['curveMaster'],x)) for i,x in enumerate(v)];l=sum(a*b for a,b in zip(v,(.299,.587,.114)));v=[l+(x-l)*(1+c['saturation']/100) for x in v]
 f=1+c['vibrance']/100*(1-(max(v)-min(v)));v=[clip(l+(x-l)*f) for x in v];return [clip(x+(.5-x)*max(0,c['fade'])/200) for x in v]
def filters(col,cache,amount=1):
 values={k:max(-3 if k=='exposure' else 0 if k in SPATIAL_KEYS or k=='fade' else -100,min(3 if k=='exposure' else 100,float(col.get(k,0)))) for k in KEYS}
 curves={k:normalize_curve(col.get(k)) for k in CURVE_KEYS}
 if (not any(values.values()) and all(curves[k]==list(IDENTITY) for k in CURVE_KEYS)) or amount==0:return []
 key=hashlib.sha256(json.dumps([values,curves,amount],sort_keys=True).encode()).hexdigest()[:24]
 cache=pathlib.Path(cache);path=cache/('look-'+key+'.cube')
 color_values={**{k:values[k] for k in COLOR_KEYS},**curves}
 has_color=any(values[k] for k in COLOR_KEYS) or any(curves[k]!=list(IDENTITY) for k in CURVE_KEYS)
 if has_color and not path.exists():
  with path.with_suffix('.tmp').open('w') as f:
   f.write('LUT_3D_SIZE 33\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
   for b in range(33):
    for g in range(33):
     for r in range(33):f.write(' '.join(f'{v:.7f}' for v in grade((r/32,g/32,b/32),color_values,amount))+'\n')
  path.with_suffix('.tmp').replace(path)
  for old in sorted(cache.glob('look-*.cube'),key=lambda p:p.stat().st_mtime,reverse=True)[32:]:old.unlink(missing_ok=True)
 result=[f"lut3d=file='{path}':interp=tetrahedral"] if has_color else []
 sharpness=values['sharpness']*amount
 definition=values['definition']*amount
 noise=values['noiseReduction']*amount
 vignette=values['vignette']*amount
 if sharpness:result.append(f'unsharp=5:5:{1.5*sharpness/100:.6f}:5:5:0')
 if definition:result.append(f'unsharp=9:9:{0.9*definition/100:.6f}:9:9:0')
 if noise:result.append(f'hqdn3d={1.5*noise/100:.6f}:{1.2*noise/100:.6f}:{4.5*noise/100:.6f}:{3.6*noise/100:.6f}')
 if vignette:result.append(f'vignette=angle={0.05+0.7*vignette/100:.6f}:mode=forward:eval=frame')
 return result

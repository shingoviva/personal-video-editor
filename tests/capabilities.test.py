import os,pathlib,sys,tempfile

with tempfile.TemporaryDirectory(prefix='pve-caps-') as tmp:
 os.environ['PVE_DATA']=tmp
 root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'))
 import core
 core.MEDIA['plain']={'id':'plain','width':1920,'height':1080,'hdr':False}
 core.MEDIA['hdr']={'id':'hdr','width':1920,'height':1080,'hdr':True}
 base={'clips':[{'media':'plain','stabilization':'OFF'}],'texts':[]}
 full={'ready':True,'stabilization':True,'hdr':True,'text':True,'drawtext':True,'textRaster':True}
 assert core.preflight_render(base,caps=full)
 for project,caps,word in [
  ({**base,'clips':[{'media':'plain','stabilization':'NATURAL'}]},{**full,'stabilization':False},'vidstab'),
  ({**base,'clips':[{'media':'hdr','stabilization':'OFF'}]},{**full,'hdr':False},'zscale'),
  ({**base,'texts':[{'text':'TITLE'}]},{**full,'text':False,'drawtext':False,'textRaster':False},'文字描画'),
 ]:
  try:core.preflight_render(project,caps=caps);raise AssertionError('missing capability accepted')
  except ValueError as e:assert word in str(e)
 print('Mac capability preflight: H.264, stabilization, HDR and text requirements PASS')

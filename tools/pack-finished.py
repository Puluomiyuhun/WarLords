from pathlib import Path
from PIL import Image
import json
import argparse
ap=argparse.ArgumentParser();ap.add_argument('frames',type=Path);ap.add_argument('--game',type=Path,default=Path(__file__).resolve().parents[1]/'种族战役2复刻');args=ap.parse_args()
root=args.game;data={}
for folder in args.frames.iterdir():
 if not folder.is_dir():continue
 frames=[];w=0;h=0
 for i in range(1,12):
  im=Image.open(folder/f'{i}.png').convert('RGBA'); box=im.getbbox(); box=(box[0]//2*2,box[1]//2*2,(box[2]+1)//2*2,(box[3]+1)//2*2)
  crop=im.crop(box);frames.append((crop,box));w=max(w,crop.width+4);h=max(h,crop.height+4)
 atlas=Image.new('RGBA',(w*6,h*2));rects=[]
 for i,(crop,box) in enumerate(frames):
  x=(i%6)*w+2;y=(i//6)*h+2;atlas.paste(crop,(x,y));rects.append(dict(x=x,y=y,w=crop.width,h=crop.height,ox=box[0]-180,oy=box[1]-150,page=0))
 name='finished-'+folder.name+'.png';atlas.save(root/'assets'/name);atlas.resize((atlas.width//2,atlas.height//2),Image.Resampling.LANCZOS).save(root/'assets/mobile'/name)
 data[folder.name]=dict(frames=11,files=[name],frameRects=rects)
script='/* Original SWF Finished (834), 11 authored frames. Extracted by tools/ExportFinished.java. */\n(function(g){function apply(C){C.finishedAtlas='+json.dumps(data,separators=(',',':'))+';\n'
script+="for(const [key,source] of Object.entries({'human-100':'human-1','human2-105':'human2-3','woodelf-106':'woodelf-2'}))C.finishedAtlas[key]=C.finishedAtlas[source];for(const [key,m]of Object.entries(C.finishedAtlas))C.atlas[key+'-finished']=m;\n}if(typeof module!=='undefined')module.exports=apply;else apply(g.CONTENT);})(globalThis);\n"
(root/'finished-content.js').write_text(script,encoding='utf-8')
print('Packed',len(data),'original race/unit running strips')

/* Code-drawn equipment over untouched original frames; no new body interpolation. */
(function(g){'use strict';const loaded=new Map();
function image(file){if(!loaded.has(file))loaded.set(file,new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>{loaded.delete(file);no(Error(file));};im.src='assets/'+file;}));return loaded.get(file);}
// Soft leather and feather shapes, with the quiver behind the original body.
function props(c,race,type,frame,x,y,sx,sy,dir,dead=false,knocked=false,alpha=1,layer='front',running=false){
 if(CONTENT.nativeReinforcements?.[type])return NativeReinforcementVisual.equipment(c,race,type,frame,x,y,sx,sy,dir,dead,knocked,alpha,layer,running);
 if(![105,106].includes(type)||knocked||(type===106)!==(layer==='back'))return;
 const frames=NativeBodyAnchors[running?'finished':type===105?3:2],matrix=frames?.[Math.max(0,Math.min(frames.length-1,frame-1))];if(!matrix)return;
 c.save();c.translate(x,y);c.scale(dir*sx,sy);c.globalAlpha=alpha;c.transform(...matrix);if(type===106)c.translate(-10,0);
 c.lineJoin='round';c.lineCap='round';
 if(type===105){
  // Narrow sling, soft pouch, folded flap and two small glass-necked bottles.
  c.strokeStyle='rgba(59,43,29,.55)';c.lineWidth=1.7;c.beginPath();c.moveTo(6,-26);c.quadraticCurveTo(4,-12,-1,0);c.stroke();
  c.strokeStyle='#a18b69';c.lineWidth=.65;c.beginPath();c.moveTo(6,-26);c.quadraticCurveTo(4,-12,-1,0);c.stroke();
  let g=c.createLinearGradient(-7,0,6,10);g.addColorStop(0,'#9d7c54');g.addColorStop(.45,'#7e5e3d');g.addColorStop(1,'#493825');
  c.fillStyle='rgba(31,25,17,.23)';c.beginPath();c.ellipse(0,7,7,6,.12,0,Math.PI*2);c.fill();
  c.fillStyle=g;c.beginPath();c.moveTo(-6,-1);c.quadraticCurveTo(0,-3,6,-1);c.lineTo(6,7);c.quadraticCurveTo(5,12,-1,11);c.quadraticCurveTo(-7,11,-7,7);c.closePath();c.fill();
  c.fillStyle='#a58d65';c.beginPath();c.moveTo(-6,-1);c.quadraticCurveTo(0,-3,6,-1);c.lineTo(4,3);c.quadraticCurveTo(-1,5,-6,2);c.closePath();c.fill();
  c.strokeStyle='rgba(208,180,132,.4)';c.lineWidth=.55;c.beginPath();c.moveTo(-5,5);c.quadraticCurveTo(-6,9,-2,10);c.stroke();
  c.strokeStyle='#5f492f';c.lineWidth=.7;c.beginPath();c.moveTo(-1,2);c.quadraticCurveTo(0,5,-1,7);c.stroke();
  for(const [bx,by]of [[1,-3],[4,-2]]){c.fillStyle='#778473';c.beginPath();c.ellipse(bx,by,1.25,2.1,-.15,0,Math.PI*2);c.fill();c.fillStyle='#b4b59b';c.beginPath();c.ellipse(bx-.4,by-.5,.35,1.1,0,0,Math.PI*2);c.fill();c.strokeStyle='#796343';c.lineWidth=1.5;c.beginPath();c.moveTo(bx,by-2);c.lineTo(bx,by-2.6);c.stroke();}
 }else{
  c.rotate(-.2);
  for(const [ax,tip]of [[-2,-29],[.6,-33],[3,-30]]){
   c.strokeStyle='#645239';c.lineWidth=1.1;c.beginPath();c.moveTo(ax-1,0);c.lineTo(ax,tip);c.stroke();
   c.strokeStyle='#b0a17c';c.lineWidth=.45;c.beginPath();c.moveTo(ax,tip+8);c.lineTo(ax-.4,-6);c.stroke();
   c.fillStyle='#90917b';c.beginPath();c.moveTo(ax,tip);c.quadraticCurveTo(ax-3,tip+2,ax-2,tip+6);c.lineTo(ax,tip+8);c.closePath();c.fill();
   c.fillStyle='#7d896d';c.beginPath();c.moveTo(ax,tip);c.quadraticCurveTo(ax+2.3,tip+2,ax+1.8,tip+5);c.lineTo(ax,tip+7);c.closePath();c.fill();
  }
  const g=c.createLinearGradient(-5,0,5,0);g.addColorStop(0,'#453c2b');g.addColorStop(.4,'#887654');g.addColorStop(.75,'#6e6041');g.addColorStop(1,'#453b29');c.fillStyle=g;
  c.beginPath();c.moveTo(-5,-17);c.quadraticCurveTo(0,-19,5,-17);c.lineTo(3,4);c.quadraticCurveTo(-1,7,-4,3);c.closePath();c.fill();
  c.strokeStyle='#9c8c66';c.lineWidth=1;c.beginPath();c.ellipse(0,-17,5,1.6,0,0,Math.PI*2);c.stroke();
  c.strokeStyle='rgba(174,156,111,.45)';c.lineWidth=.5;c.beginPath();c.moveTo(-2,-14);c.lineTo(-2,1);c.stroke();
  c.strokeStyle='#4c4f32';c.lineWidth=1.4;c.beginPath();c.moveTo(-4,-8);c.quadraticCurveTo(0,-7,4,-9);c.stroke();
 }
 c.restore();
}
const behind=(...args)=>props(...args,'back');
// Tint only cyan spell pixels in a cached frame. Skin, clothing and alpha stay intact.
const healingFrames=new WeakMap();
function healFrame(im,r,textureScale=1){
 let cache=healingFrames.get(im);if(!cache){cache=new Map();healingFrames.set(im,cache);}
 const key=[r.x,r.y,r.w,r.h,textureScale].join(',');if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;const c=canvas.getContext('2d');
 c.drawImage(im,r.x*textureScale,r.y*textureScale,r.w*textureScale,r.h*textureScale,0,0,r.w,r.h);
 const pixels=c.getImageData(0,0,r.w,r.h),d=pixels.data;
 for(let i=0;i<d.length;i+=4){const red=d[i],green=d[i+1],blue=d[i+2],cyan=Math.min(green-red,blue-red);
  if(d[i+3]&&cyan>18&&Math.abs(green-blue)<80){d[i]=red+cyan*.6;d[i+2]=blue-cyan*.85;}
 }
 c.putImageData(pixels,0,0);cache.set(key,canvas);return canvas;
}
// Reuse the original attack bolt's flight and impact frames, tinted healing green.
let orbFrames;
const ready=image(CONTENT.magicAtlas.bolt.files[0]).then(im=>{orbFrames=CONTENT.magicAtlas.bolt.frameRects.map(r=>({canvas:healFrame(im,r),r}));});
ready.catch(()=>{});
function healOrb(c,x,y,scale=1,vx=1,vy=0,frame=1){
 if(!orbFrames)return;const {canvas,r}=orbFrames[Math.min(orbFrames.length-1,Math.max(1,frame)-1)];
 c.save();c.translate(x,y);c.scale((vx<0?-1:1)*scale,scale);c.drawImage(canvas,r.ox,r.oy,r.w,r.h);c.restore();
}
function status(c,x,y,sx,sy,tick,healUntil,slowUntil){if(tick>=healUntil&&tick>=slowUntil)return;c.save();c.translate(x,y);c.scale(sx,sy);
 if(tick<slowUntil){c.strokeStyle='#728952';c.lineWidth=2;c.globalAlpha=.8;c.beginPath();c.ellipse(0,-2,23,7,0,0,Math.PI*2);c.moveTo(-17,0);c.lineTo(-12,-14);c.lineTo(-7,-4);c.moveTo(14,2);c.lineTo(17,-12);c.stroke();}
 if(tick<healUntil){const age=24-(healUntil-tick);c.globalAlpha=Math.min(1,(healUntil-tick)/10);c.fillStyle='#bdcaaa';c.fillRect(-2,-88-age,4,15);c.fillRect(-7,-83-age,14,4);}
 c.restore();}
async function portrait(canvas,race,type){const m=CONTENT.atlas[race+'-'+type],r=m.frameRects[0],im=await image(m.files[r.page]);canvas.width=240;canvas.height=240;const c=canvas.getContext('2d'),k=Math.min(195/r.w,195/r.h),x=120-(r.ox+r.w/2)*k,y=120-(r.oy+r.h/2)*k;c.clearRect(0,0,240,240);behind(c,race,type,1,x,y,k,k,1,false,false,1);c.drawImage(im,r.x,r.y,r.w,r.h,x+r.ox*k,y+r.oy*k,r.w*k,r.h*k);props(c,race,type,1,x,y,k,k,1);}
function icon(im,race,type){im.onload=async()=>{im.onload=null;try{const c=document.createElement('canvas');await portrait(c,race,type);const icon=document.createElement('canvas');icon.width=icon.height=240;icon.getContext('2d').drawImage(c,76,76,88,88);im.src=icon.toDataURL();}catch{im.title='预览暂未载入';}};}
const running=(c,race,type,frame,x,y,sx,sy,dir,layer)=>props(c,race,type,frame,x,y,sx,sy,dir,false,false,1,layer,true);
g.NativeSpecialVisual={running,props,behind,status,portrait,icon,healFrame,healOrb,ready};})(globalThis);

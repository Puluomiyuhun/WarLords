/* Shared local/co-op rendering for original spell atlases and support exit props. */
(function(g){'use strict';
function files(C){return [...new Set(Object.entries(C.restorationAtlas).filter(([k])=>!k.startsWith("mage-")).flatMap(([,m])=>m.files))];}
function finish(c,u,x,y,sx,sy,draw){const dir=u.fleeing?-u.dir:u.dir;if(u.type===100)BannerVisual.standard(c,x,y,sx,sy,dir,u.finishedFrame);NativeSpecialVisual.running(c,u.race,u.type,u.finishedFrame,x,y,sx,sy,dir,'back');draw(CONTENT.finishedAtlas[u.race+'-'+u.type],x,y,sx,sy,dir,u.finishedFrame);NativeSpecialVisual.running(c,u.race,u.type,u.finishedFrame,x,y,sx,sy,dir,'front');}
function fx(c,list,lane,row,worldX,draw){for(const e of list||[]){if(e.lane!==lane)continue;const m=CONTENT.restorationAtlas[e.key];if(!m)continue;let f=1+e.age%m.frames;if(e.key==='iceblock')f=Math.min(26,1+e.age);if(e.key==='pit')f=Math.min(m.frames,1+e.age);if([26,28,31].includes(e.spell))f=e.hit?Math.min(m.frames,3+e.age-e.hitAge):1+e.age%Math.min(2,m.frames);draw(m,worldX(e.x,lane),row.y+e.y*row.sy,2*row.sx*e.scale,2*row.sy*e.scale,e.dir,f,Math.min(1,(e.duration-e.age)/8));}}
function status(c,u,x,y,sx,sy,tick,draw){if(u.dead||u.finishing)return;if(!u.sick&&!u.weak&&![u.resistUntil,u.rallyUntil,u.controlUntil].some(t=>tick<t))return;if(u.sick){const m=CONTENT.restorationAtlas.disease;draw(m,x,y-60*sy,1.5*sx,1.5*sy,1,1+tick%m.frames,.65);}c.save();c.translate(x,y);c.scale(sx,sy);c.lineWidth=1.5;
 if(u.weak){c.strokeStyle='#9877a9';c.beginPath();c.ellipse(0,-2,22,5,0,0,Math.PI*2);c.stroke();c.fillStyle='#b49ac1';c.fillText('↓',-4,-90);}
 for(const [key,color,label]of [['resistUntil','#b9d8e1','◇'],['rallyUntil','#e1cb78','↑'],['controlUntil','#a68ce0','◆']])if(tick<(u[key]||0)){c.fillStyle=color;c.font='bold 15px serif';c.fillText(label,-6,-100);}
 c.restore();}
g.RestorationVisual={files,finish,fx,status};})(globalThis);

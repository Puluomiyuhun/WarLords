/* Siege projectiles follow the original SWF scripts, not ordinary arrows. */
(function(g){'use strict';function install(Battle,C){const B=Battle.prototype;
const TYPES=new Set([21,23,24,27,28,30,47]);
B.fireSiege=function(u,visual){
 if(!TYPES.has(u.type))return false;
 const v=this.victim(u.targetId);if(!v||v.dead||v.finishing||v.exited||v.side===u.side)return true;
 const count=u.type===23?5:1;
 for(let i=0;i<count;i++){
  const velocity=visual==='rock'?(u.type===27?35:43):50;
  let damage=({rock:u.type===27?150:200,skull:50,log:100,fire:200,obelisk:220})[visual];
  if(visual==='rock')for(const id of [32,33])if(this.has(u.owner,u.type,id)){damage*=1+C.upgrades[id].percent/100;break;}
  const p={id:this.nextId++,owner:u.owner,side:u.side,dir:u.dir,sourceId:u.id,firerType:u.type,targetId:v.id,lane:u.lane,x:u.x,y:-66,vx:0,vy:0,age:0,frame:1,visual,damage,big:['rock','skull','log'].includes(visual),siegeShot:true,rotation:0,alpha:1};
  if(visual==='fire'){p.vx=50*u.dir;}
  else if(visual==='obelisk'){p.y=-266;p.phase='rise';}
  else {
   let range=v.x-u.x;
   if(v.moving){const speed=this.boost(v.speed,v.owner,v.type,'speed');range=v.x+96*speed*v.dir-u.x;range=v.dir<0?Math.max(200,range):Math.min(-200,range);}
   let angle=Math.asin(range/(velocity*velocity))/2;if(!Number.isFinite(angle))angle=u.dir*Math.PI/4;
   p.vx=velocity*Math.sin(angle);p.vy=-velocity*Math.cos(angle);
   p.y-=visual==='rock'&&u.type===27?510:200;
   if(visual==='skull'){p.y+=this.int(30)-this.int(30);p.x+=this.int(30)+this.int(30);p.vx+=(this.random()-this.random())*5+this.random()-this.random();}
   p.rotation=Math.atan2(p.vy,p.vx)+Math.PI/2;
  }
  this.projectiles.push(p);
 }
 this.events.push({type:'bow'});return true;
};
// Flash hitTest used the displayed clips' bounds. Use current sprite bounds;
// this is still bounding-box collision, not per-pixel alpha collision.
B.siegeOverlap=function(p,v){
 if(!v||v.castle)return false;
 const m=C.atlas[v.race+'-'+v.type],r=m?.frameRects[Math.max(0,Math.min(m.frames-1,v.frame-1))];
 const pm=C.projectileAtlas[p.visual],q=pm.frameRects[Math.max(0,Math.min(pm.frames-1,p.frame-1))];
 if(!r)return false;
 function box(x,y,rect,dir,rotation){const corners=[];const co=Math.cos(rotation),si=Math.sin(rotation);for(const xx of [rect.ox,rect.ox+(rect.dw||rect.w)])for(const yy of [rect.oy,rect.oy+(rect.dh||rect.h)])corners.push([x+2*(xx*dir*co-yy*si),y+2*(xx*dir*si+yy*co)]);return {left:Math.min(...corners.map(v=>v[0])),right:Math.max(...corners.map(v=>v[0])),top:Math.min(...corners.map(v=>v[1])),bottom:Math.max(...corners.map(v=>v[1]))};}
 const a=box(p.x,p.y,q,p.dir,p.rotation),b=box(v.x,0,r,v.dir,0);
 return a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
};
B.stepSiegeProjectile=function(p){
 p.age++;const v=this.victim(p.targetId),alive=v&&!v.dead&&!v.finishing&&!v.exited&&v.side!==p.side;
 if(p.phase==='impact'){if(++p.frame>C.projectileAtlas[p.visual].frames)p.done=true;return;}
 if(p.visual==='fire'){
  p.x+=p.vx;p.frame=p.frame===1?2:1;
  if(alive&&(v.castle?Math.abs(v.x-p.x)<100:this.siegeOverlap(p,v))){if(!v.shield)this.hurt(v,this.int(p.damage),p,false,'magic');p.phase='impact';p.frame=3;}
  if(Math.abs(p.x)>1400||p.age>200)p.done=true;return;
 }
 if(p.visual==='obelisk'){
  if(p.phase==='rise'){p.vy--;if(p.y<-2000){p.vy=-p.vy;p.phase='fall';}p.y+=p.vy;}
  else {if(v)p.x=v.castle?p.dir*1500:v.x;
   if(alive&&(v.castle?p.y>-200:this.siegeOverlap(p,v))){this.hurt(v,this.int(p.damage),p,false,'magic');p.phase='impact';p.frame=2;return;}p.y+=p.vy;
   if(p.y>100)p.done=true;
  }
  if(p.age>200)p.done=true;return;
 }
 if(p.y>-35){p.x+=p.vx;p.vx/=1.099971389770508;p.rotation+=p.vx*Math.PI/180;p.alpha=Math.max(0,p.alpha-.01);if(p.alpha<=.00001)p.done=true;return;}
 p.x+=p.vx;p.y+=p.vy;p.rotation=p.bouncing?p.rotation+p.spin:Math.atan2(p.vy,p.vx)+Math.PI/2;p.vy++;
 if(!p.hit&&alive&&p.y>-200&&(v.castle?p.vy>0:this.siegeOverlap(p,v))){p.hit=true;
  if(v.type===33&&this.random()>.2999997615814209){p.bouncing=true;p.vy=-p.vy/5;p.vx=this.int(20)-this.int(20);p.spin=(this.int(30)-this.int(30))*Math.PI/180;}
  else {this.hurt(v,this.int(p.damage)*(v.castle?4:1),p,false,'ranged');if(v.castle)p.done=true;}
 }
 if(p.age>400)p.done=true;
};
B.ramStrike=function(u){
 const power=u.speed*10,contact=this.target(u,100);
 if(contact){u.targetId=contact.id;if(contact.castle){u.speed=-u.speed;if(Math.abs(u.speed)<10)u.speed=-(10-this.int(5));}else u.speed=0;}
 if(power>0)this.impact(u,{range:100,power,original:true});
};
}if(typeof module!=='undefined')module.exports=install;else g.installSiege=install;})(globalThis);

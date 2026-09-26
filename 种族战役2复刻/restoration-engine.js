/* Script parity extensions. All gameplay uses the authoritative fixed-step RNG. */
(function(g){'use strict';function install(Battle,C){const B=Battle.prototype;
 B.active=function(u){return u&&!u.castle&&!u.dead&&!u.downedTicks&&!u.exited&&!u.finishing&&!u.climbFrame&&!u.enterFrame&&!u.fleeing;};
 B.resistsMagic=function(v){if(!this.active(v))return true;if(this.has(v.owner,v.type,41)){v.resistUntil=this.tick+24;return true;}return false;};
 B.effect=function(key,u,extra={}){const e={id:this.nextId++,key,owner:u.owner,side:u.side,lane:u.lane,x:u.x,y:0,dir:u.dir,race:u.race,age:0,duration:24,scale:1,...extra};this.effects.push(e);return e;};
 B.chooseSpell=function(u){if(!C.units[u.type].caster||this.random()<=.7999852180480957)return false;
  const choices=[];for(const s of Object.values(C.spells)){if(!this.has(u.owner,u.type,s.id)||(s.id===17?u.castCount:(u.castUses?.[s.id]||0))>=s.limit)continue;
   let targets=this.units.filter(v=>this.active(v)&&v.side!==u.side&&!v.knockFrame&&(s.all||v.lane===u.lane)&&(v.x-u.x)*u.dir>s.min&&(v.x-u.x)*u.dir<s.max);
   if(s.id===16){if(!this.units.some(v=>this.active(v)&&v.side===u.side&&v.id!==u.id&&C.units[v.type].specialUpgrade>=0&&v.specialLevel===1))continue;targets=[u];}
   if(s.id===29){targets=this.units.filter(v=>v.dead&&!v.exited&&!v.summoned&&v.side!==u.side&&C.units[v.type].genericAnimations);}
   if(s.id===25)targets=targets.filter(v=>!v.sick);
   if(targets.length)choices.push({s,v:targets[this.int(targets.length)]});
  }
  if(!choices.length)return false;const {s,v}=choices[this.int(choices.length)];u.targetId=v.id;u.spellId=s.id;u.spellDone=false;(u.castUses??={})[s.id]=(u.castUses[s.id]||0)+1;if(s.id===17)u.castCount++;u.frame=C.units[u.type].labels[s.pose];return true;
 };
 B.flee=function(v){if(!this.active(v)||!C.units[v.type].genericAnimations)return;v.fleeing=true;v.fleeAge=0;v.targetId=null;v.knockFrame=0;v.fallSpeed=0;v.shield=false;v.finishedFrame=C.finishedAtlas[v.race+'-'+v.type]?1:0;};
 B.resolveSpell=function(u){const id=u.spellId,v=this.victim(u.targetId);u.spellDone=true;
  const enemies=(lane,x,range=Infinity)=>this.units.filter(w=>this.active(w)&&w.side!==u.side&&(lane===null||w.lane===lane)&&Math.abs(w.x-x)<range);
  if(id===16){for(const w of this.units)if(this.active(w)&&w.side===u.side&&w.id!==u.id&&C.units[w.type].specialUpgrade>=0){w.specialLevel=2;w.rallyUntil=this.tick+48;}return;}
  if(id===29){for(const corpse of [...this.units])if(corpse.dead&&!corpse.exited&&!corpse.summoned&&corpse.side!==u.side&&C.units[corpse.type].genericAnimations){corpse.exited=true;const n=this.spawn(u.owner,48,corpse.lane,corpse.x);n.summoned=true;n.race='undead';n.frame=1;n.maxHp=n.hp=25;}return;}
  if(id===15||id===22){if(!this.active(v))return;this.effect('mind',u,{duration:18});if(id===15)u.lane=(u.lane+1+this.int(7))%8;else u.x+=1000*u.dir;if(this.fort(u))u.x=u.dir*Math.min(1350,u.x*u.dir);this.effect('mind',u,{duration:18});if(id===15)u.frame=(C.units[u.type].labels.ready||1);return;}
  if(!this.active(v)||v.side===u.side)return;
  if(id===17){this.fireMagic(u,'orb');return;}
  if([26,28,31].includes(id)){if(this.resistsMagic(v))return;this.effect(id===26?'mind':id===28?'iceball':'fireball',u,{spell:id,targetId:v.id,x:u.x,y:-66,vx:(id===26?30:50)*u.dir,duration:200});return;}
  if(id===27){this.effect('weakness',u,{spell:id,duration:21});return;}
  if(id===24){for(let lane=0;lane<8;lane++){const w=enemies(lane,u.x).find(w=>C.units[w.type].genericAnimations);if(w&&!this.resistsMagic(w))this.flee(w);}return;}
  if(id===23){for(const w of enemies(u.lane,u.x))if(!this.resistsMagic(w)){this.hurt(w,this.int(30),u,false,'magic');this.knock(w);}this.effect('lightning',u,{duration:9,scale:.6});return;}
  if(this.resistsMagic(v))return;
  if(id===14){this.effect('lightning',v,{owner:u.owner,side:u.side,scale:2,duration:9});for(const w of enemies(v.lane,v.x,200))if(w===v||!this.resistsMagic(w)){this.hurt(w,this.int(100),u,false,'magic');this.knock(w);}return;}
  if(id===18){this.effect('iceblock',v,{owner:u.owner,side:u.side,spell:id,x:v.x+20*v.speed*v.dir,targetId:v.id,scale:2.5,duration:120});return;}
  if(id===19){this.hurt(v,50+this.int(50),u,false,'magic');this.knock(v);v.liftUntil=this.tick+38;return;}
  if(id===20){this.effect('pit',v,{owner:u.owner,side:u.side,spell:id,scale:2.5,duration:83});return;}
  if(id===21){this.effect('tornado',v,{owner:u.owner,side:u.side,spell:id,vx:this.int(20)-this.int(20),scale:2.5,duration:85});return;}
  if(id===25){v.sick=true;v.sickOwner=u.owner;return;}
  if(id===30){this.effect('death',v,{owner:u.owner,side:u.side,duration:10});this.hurt(v,v.hp+1,u,true);}
 };
 B.stepEffects=function(){for(const e of this.effects){e.age++;const caster={owner:e.owner,side:e.side,lane:e.lane},enemies=()=>this.units.filter(v=>this.active(v)&&v.side!==e.side&&v.lane===e.lane);
   if(e.key.startsWith('horse-')){e.x+=e.dir*Math.min(30,5+e.age*.75);}
   if([26,28,31].includes(e.spell)&&!e.hit){const old=e.x;e.x+=e.vx;const v=this.victim(e.targetId);if(!this.active(v)||v.side===e.side||v.lane!==e.lane){e.done=true;continue;}if(v.x>=Math.min(old,e.x)-55&&v.x<=Math.max(old,e.x)+55){e.hit=true;e.hitAge=e.age;e.duration=e.age+14;
     if(!this.resistsMagic(v)){if(e.spell===26){v.originOwner??=v.owner;v.owner=e.owner;v.side=e.side;v.dir=e.dir;v.targetId=null;v.frame=(C.units[v.type].labels.ready||1);v.controlUntil=this.tick+36;}
      else {if(e.spell===28||!v.shield)this.hurt(v,this.int(e.spell===28?150:200),caster,false,'magic');if(e.spell===28)this.knock(v);}}
    }if(Math.abs(e.x)>1500)e.done=true;
   }
   if(e.spell===27&&e.age===8)for(const v of enemies())if(!this.resistsMagic(v))v.weak=true;
   if(e.spell===18&&e.age===20)for(const v of enemies())if((v.id===e.targetId||Math.abs(v.x-e.x)<70)&&!this.resistsMagic(v))this.hurt(v,1000,caster,false,'magic');
   if(e.spell===20&&[7,15,25,35,45,55,65].includes(e.age))for(const v of [...this.units])if(this.active(v)&&v.lane===e.lane&&Math.abs(v.x-e.x)<168&&!this.resistsMagic(v)){this.hurt(v,v.hp+1,caster,true);v.fallUntil=this.tick+24;}
   if(e.spell===21){e.x+=e.vx;if(this.random()>.9799895095825195)e.vx=this.int(20)-this.int(20);if(e.age%11===0&&e.age<=75)for(const v of enemies())if(Math.abs(v.x-e.x)<170&&!this.resistsMagic(v)){this.hurt(v,this.int(30),caster,false,'magic');this.knock(v);v.liftUntil=this.tick+38;}}
  }this.effects=this.effects.filter(e=>!e.done&&e.age<e.duration);};
 B.stepStatus=function(u){if(u.sick&&!u.dead){if(this.resistsMagic(u)||this.random()>.9899985694885254)u.sick=false;else this.hurt(u,1,{owner:u.sickOwner,side:this.options.teams[u.sickOwner],lane:u.lane},true,'magic');}
  if(u.fleeing&&!u.dead){u.fleeAge++;u.x-=u.dir*15;u.finishedFrame=C.finishedAtlas[u.race+'-'+u.type]?u.finishedFrame%11+1:0;if(Math.abs(u.x)>2600)u.exited=true;else if(u.fleeAge>50&&this.random()>.9699952316284179){u.fleeing=false;u.finishedFrame=0;u.frame=(C.units[u.type].labels.ready||1);}return true;}return false;
 };
 B.dismount=function(u){const old=u.type;this.effect('horse-'+u.race,u,{duration:96});u.type=old===4?0:5;u.dismountedFrom=old;u.speed=C.units[u.type].speed;u.hp=u.maxHp=this.boost(C.units[u.type].health,u.owner,u.type,'armour');u.frame=(C.units[u.type].labels.ready||1);u.specialLevel=1;u.targetId=null;u.dismounting=false;u.shield=false;};
 // Validate authoritative additions before assigning them to a restored battle.
 Battle.validateRestoration=function(s,C){const n=s.players.length,ints=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
  for(const u of s.units){for(const k of ['sick','weak','fleeing','spellDone','summoned','dismounting'])if(u[k]!==undefined&&typeof u[k]!=='boolean')throw Error('法术单位状态不正确');
   for(const k of ['resistUntil','liftUntil','fallUntil','controlUntil','rallyUntil'])if(u[k]!==undefined&&!ints(u[k],0,s.tick+120))throw Error('法术状态时间不正确');
   if(u.originOwner!==undefined&&!ints(u.originOwner,0,n-1)||u.sickOwner!==undefined&&!ints(u.sickOwner,0,n-1)||u.fleeing&&!ints(u.fleeAge,0,1000000)||u.spellId!=null&&(!C.spells[u.spellId]||!C.units[u.type].caster)||u.summoned&&u.type!==48||u.dismountedFrom!==undefined&&![4,6].includes(u.dismountedFrom))throw Error('法术来源不正确');
   if(u.castUses!==undefined&&(!u.castUses||Array.isArray(u.castUses)||typeof u.castUses!=='object'||!Object.entries(u.castUses).every(([id,count])=>C.spells[id]&&ints(count,0,C.spells[id].limit))))throw Error('施法次数不正确');
  }
  if(s.effects!==undefined&&(!Array.isArray(s.effects)||s.effects.length>3000||!s.effects.every(e=>C.restorationAtlas[e.key]&&ints(e.id,1,s.nextId-1)&&ints(e.owner,0,n-1)&&e.side===s.options.teams[e.owner]&&ints(e.lane,0,7)&&[-1,1].includes(e.dir)&&[e.x,e.y,e.scale].every(Number.isFinite)&&e.scale>0&&e.scale<=3&&ints(e.age,0,250)&&ints(e.duration,1,250)&&(e.vx===undefined||Number.isFinite(e.vx)&&Math.abs(e.vx)<=60)&&(e.spell===undefined||[18,20,21,26,27,28,31].includes(e.spell)))))throw Error('法术效果存档不正确');
 };
}if(typeof module!=='undefined')module.exports=install;else g.installRestoration=install;})(globalThis);

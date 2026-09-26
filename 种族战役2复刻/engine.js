/* Independent fixed-step battle simulation. No renderer or Flash dependency. */
(function(g){
'use strict';
const C=typeof module!=='undefined'?require('./content.js'):g.CONTENT;
if(typeof module!=='undefined')require('./balance.js')(C);
const P=typeof module!=='undefined'?require('./progression.js'):g.Progression;
const LEGACY_ORDER=[0,1,2,5],ORDER=C.order||LEGACY_ORDER, FPS=24;
const RALLY_KILLS=C.rallyKillsRequired,HEAL_COOLDOWN=168;
const MAGIC_FLIGHT=Object.freeze({height:-66,speed:60});
class Battle{
 constructor(options={}){
  this.options={seed:1234567,mode:'solo',races:['human','orc'],difficulty:60,terrain:'forest',...options};
  this.options.rosters=this.options.races.map((race,side)=>[...(options.rosters?.[side]||C.races?.[race]?.roster.slice(0,10)||LEGACY_ORDER)]);
  this.options.teams=this.options.mode==='coop'?this.options.races.map((_,i)=>i<2?0:1):[0,1];
  this.options.upgrades=this.options.races.map((race,i)=>structuredClone(options.upgrades?.[i]||{}));
  this.rng=this.options.seed>>>0||1;this.tick=0;this.nextId=1;this.units=[];this.projectiles=[];this.effects=[];
  this.players=this.options.races.map((race,side)=>({side,lane:3,selected:this.options.rosters[side][0],charge:0,auto:false,special:false,allowChange:true,kills:0,killReward:0,rallyKills:0,spawned:0}));
  this.scores=[0,0];this.winner=null;this.commands=[];this.events=[];this.hits=0;
  this.siege=this.options.siege?{side:this.options.siege.side,target:this.options.siege.target,score:0,ladders:Array(8).fill(false)}:null;
 }
 random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
 int(n){return Math.floor(this.random()*n);}
 def(u){return C.units[u.type];}
 meleeDistance(u,v){return Math.max(0,Math.abs(v.x-u.x)-(this.def(v)?.elephant?60:0));}
 victim(id){if(id<0&&this.siege)return {id,castle:true,side:this.siege.side,lane:-id-1,x:this.siege.side===1?1400:-1400};return this.units.find(u=>u.id===id);}
 fort(u){return this.siege&&u.side!==this.siege.side?this.victim(-u.lane-1):null;}
 roster(side){return this.options.rosters[side];}
 has(owner,type,id){return P.has(this.options.upgrades[owner],type,id);}
 boost(base,owner,type,kind){return P.apply(base,this.options.upgrades[owner],type,kind);}
 canSpecial(owner,type=this.players[owner].selected){return this.has(owner,type,C.units[type].specialUpgrade);}
 chargeNeeded(owner){const p=this.players[owner];return C.units[p.selected].charge*(p.special&&this.canSpecial(owner)?2:1);}
 command(side,type,value,record=true){
  if(this.winner!==null||!this.players[side])return false;
  const p=this.players[side];
  if(type==='select'&&!this.roster(side).includes(value)||type==='lane'&&(!Number.isInteger(value)||value<0||value>7)||['auto','special'].includes(type)&&typeof value!=='boolean'||type==='special'&&value&&!this.canSpecial(side)||!['select','lane','send','rally','auto','special'].includes(type))return false;
  if(record)this.commands.push({tick:this.tick,side,type,value});
  if(type==='select'){p.selected=value;if(!this.canSpecial(side,value))p.special=false;}
  if(type==='lane')p.lane=value;
  if(type==='auto')p.auto=value;
  if(type==='special')p.special=value;
  if(type==='send')return this.send(side);
  if(type==='rally')return this.rally(side);
  return true;
 }
 send(side){const p=this.players[side],d=C.units[p.selected];if(p.charge<this.chargeNeeded(side))return false;
  const special=this.canSpecial(side)&&p.charge>=2*d.charge;this.spawn(side,p.selected,p.lane,undefined,special);p.charge=0;p.allowChange=true;return true;
 }
 rally(side){const p=this.players[side];if(!p||p.rallyKills<RALLY_KILLS||p.charge<this.chargeNeeded(side))return false;
  const special=this.canSpecial(side)&&p.charge>=2*C.units[p.selected].charge;
  for(let lane=0;lane<8;lane++)this.spawn(side,p.selected,lane,undefined,special);
  p.rallyKills=0;p.charge=0;p.allowChange=true;this.events.push({type:'rally',owner:side});return true;
 }
 spawn(owner,type,lane,x,special=false){
  const side=this.options.teams[owner],d=C.units[type],health=this.boost(d.health,owner,type,'armour'),u={id:this.nextId++,owner,side,type,lane,race:P.unitRace({race:this.options.races[owner],mercenaries:this.options.mercenaries===true&&owner<2},type),dir:side===0?1:-1,x:x??(side===0?-1400:1400),hp:health,maxHp:health,speed:[4,6].includes(type)?0:d.speed+this.random()/2,frame:1,dead:false,ageDead:0,stopped:false,targetId:null,moving:false,ammo:10,shield:false,flash:0,specialLevel:special&&this.canSpecial(owner,type)?2:1,castCount:0};
  if(d.ram&&this.has(owner,type,37))u.speed=10;this.units.push(u);this.players[owner].spawned++;this.events.push({type:'spawn',unit:type,side});return u;
 }
 target(u,range){
  const d=this.def(u),r=range??(d.ram?Math.max(0,u.speed*20):d.range*2);
  let best=null,dist=Infinity;
  for(const v of this.units){if(v.dead||v.fleeing||v.finishing||v.downedTicks||v.exited||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane)continue;
   const dx=(v.x-u.x)*u.dir,ab=d.ranged?Math.abs(v.x-u.x):this.meleeDistance(u,v);
   if(dx>=0&&ab<r&&(!d.ranged||d.projectile==='bolt'||u.type===38||ab>r/2)&&ab<dist){best=v;dist=ab;}
  }
  const fort=this.fort(u);
  if(!best&&fort&&Math.abs(fort.x-u.x)<r&&(!d.ranged||!d.genericAnimations)&&(!this.siege.ladders[u.lane]||!d.genericAnimations))return fort;
  return best;
 }
 decide(u){
  const d=this.def(u);u.moving=false;if(this.nativeDecide(u))return;
  if(d.medic){const v=this.healTarget(u);if(v&&this.tick>=(u.healReadyAt||0)){u.targetId=v.id;u.healReadyAt=this.tick+HEAL_COOLDOWN;u.frame=d.labels.swipe1;}else{u.targetId=null;const patient=this.healFollowTarget(u);u.frame=patient?(Math.abs(patient.x-u.x)>100?((patient.x-u.x)*u.dir<0?d.labels.walkback:d.labels.walk):d.labels.ready):(this.target(u,180)?d.labels.ready:d.labels.walk);}return;}
  u.spellId=null;u.spellDone=false;if(this.chooseSpell(u))return;
  // Human archmages retain a basic bolt when no purchased spell is available.
  if(u.type===38){const v=this.target(u,2000);if(v){u.targetId=v.id;u.frame=d.labels.spell1;return;}}
  const close=u.type===2&&this.has(u.owner,u.type,36)?this.units.find(v=>this.active(v)&&v.side!==u.side&&v.lane===u.lane&&(v.x-u.x)*u.dir>=0&&Math.abs(v.x-u.x)<70):null;
  const v=close||this.target(u);u.targetId=v?.id??null;if(close){u.frame=d.labels.kick;return;}
  if(v?.castle&&u.type===19){u.frame=d.labels.placeladder;return;}
  if(v&&this.random()>0.1999966621398926&&(!d.usesAmmo||u.ammo>0))u.frame=u.specialLevel>1&&d.labels.specialattack?d.labels.specialattack:d.labels['swipe'+(this.int(d.swipes)+1)];
  else u.frame=u.specialLevel>1&&d.labels.special?d.labels.special:d.labels.walk;
 }
 healEligible(u,v,checkRange=true,checkLock=true){return v&&!v.castle&&v.id!==u.id&&v.side===u.side&&v.lane===u.lane&&!v.dead&&!v.fleeing&&!v.finishing&&!v.exited&&!v.downedTicks&&!v.knockFrame&&!v.climbFrame&&!v.enterFrame&&!this.def(v).big&&!this.def(v).medic&&v.hp<v.maxHp&&(!checkRange||Math.abs(v.x-u.x)<=this.def(u).range)&&(!checkLock||this.tick>=(v.healLockUntil||0));}
 healFollowTarget(u){return this.units.filter(v=>this.healEligible(u,v,false,false)&&Math.abs(v.x-u.x)<=600).sort((a,b)=>Math.abs(a.x-u.x)-Math.abs(b.x-u.x)||a.id-b.id)[0];}
 healTarget(u){return this.units.filter(v=>this.healEligible(u,v)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];}
 heal(u){const v=this.victim(u.targetId);if(!this.healEligible(u,v,false))return;
  // Range is checked when selecting a patient, not again after the casting wind-up.
  v.healLockUntil=this.tick+96;const dir=Math.sign(v.x-u.x)||u.dir;
  this.projectiles.push({id:this.nextId++,owner:u.owner,side:u.side,dir,kind:'heal',lane:u.lane,x:u.x,y:MAGIC_FLIGHT.height,vx:MAGIC_FLIGHT.speed*dir,vy:0,targetId:v.id,firerType:u.type,age:0,frame:1});
 }
 stepHeal(p){if(p.done)return;p.age++;
  if(p.frame>=3){if(++p.frame>16)p.done=true;return;}
  const v=this.victim(p.targetId);
  if(!v||v.castle||v.dead||v.finishing||v.exited||v.downedTicks||v.knockFrame||v.climbFrame||v.enterFrame||v.side!==p.side||v.lane!==p.lane){p.done=true;return;}
  const old=p.x;p.x+=p.vx;p.y+=p.vy;p.frame=p.frame===1?2:1;
  if(v.x>=Math.min(old,p.x)-55&&v.x<=Math.max(old,p.x)+55){v.hp=Math.min(v.maxHp,v.hp+this.healingAmount(v,18));v.healPulseUntil=this.tick+24;p.frame=3;}
  else if(Math.abs(p.x)>1400||p.age>200)p.done=true;
 }
 slowFactor(u){return this.tick<(u.slowUntil||0)?([4,6].includes(u.type)||this.def(u).elephant?0.75:0.5):1;}
 entangle(v){if(v.castle||v.dead||v.finishing||v.exited||v.downedTicks||v.knockFrame||v.climbFrame||v.enterFrame||this.def(v).big&&!this.def(v).elephant||this.tick<(v.rootImmuneUntil||0))return;v.slowUntil=this.tick+48;v.rootImmuneUntil=this.tick+120;}
 laneSupported(side,lane){return this.units.some(u=>u.type===C.banner.unit&&u.side===side&&u.lane===lane&&!u.dead&&!u.finishing&&!u.exited&&!u.climbFrame&&!u.enterFrame);}
 hurt(v,amount,attacker,exact=false,kind=null){
  if(!exact&&attacker&&this.laneSupported(attacker.side,attacker.lane))amount*=C.banner.attack;
  if(!exact&&!v.castle&&this.laneSupported(v.side,v.lane))amount*=C.banner.damageTaken;
  if(v.castle){this.siege.score+=Math.min(200,Math.max(0,amount));this.events.push({type:'hit',side:attacker?.side??0});return;}
  if(v.dead||v.fleeing||v.finishing||v.downedTicks)return;if(kind==='melee'&&this.tick<(v.breachUntil||0))amount*=1.2;if(kind==='magic')amount=this.absorbWard(v,amount);v.hp-=amount;v.flash=3;this.hits++;this.events.push({type:'hit',side:attacker?.side??0});
  if(v.hp<=0&&v.type===102&&!v.reviveUsed){v.hp=0;v.reviveUsed=true;v.downedTicks=72;v.reviveAttacker=attacker?.owner??null;v.moving=false;v.shield=false;v.knockFrame=0;v.fallSpeed=0;v.frame=this.def(v).labels.die1;return;}
  if(v.hp<=0){v.hp=0;v.dead=true;v.stopped=false;v.frame=this.def(v).labels.die1;v.ageDead=0;const credit=(attacker?.side!==v.side?attacker?.owner:undefined)??this.options.teams.findIndex(team=>team!==v.side);if(this.players[credit]){const p=this.players[credit];p.kills++;p.killReward=(p.killReward||0)+Math.ceil(Math.ceil(C.units[v.type].price/50)/2);p.rallyKills=Math.min(RALLY_KILLS,p.rallyKills+1);}this.collectSoul(v);}
 }
 attack(u,hit){
  const v=this.victim(u.targetId);if(!v||v.dead||v.finishing||v.downedTicks||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane||!v.castle&&this.meleeDistance(u,v)>hit.range*2)return;
  const d=this.def(u);let power=this.boost(hit.power,u.owner,u.type,'attack');if(u.weak)power/=3;if(this.has(u.owner,u.type,35)&&this.random()<.04999916553497315)v.weak=true;
  if(this.def(v)?.elephant&&[0,5].includes(u.type))power*=1.5;
  if(v.castle){if(d.big)this.hurt(v,this.int(power),u);else if((u.wallHits=(u.wallHits||0)+1)>10){u.enterFrame=1;u.x=u.dir*1400;this.siege.score+=150;}return;}
  if(d.bonusAgainst.includes(v.type))power*=1+d.bonus/100;
  if(!v.shield){const before=v.hp;this.hurt(v,this.int(power),u,false,'melee');this.nativeHit(u,v,before-v.hp);}
  if(d.elephant){const victims=this.units.filter(w=>!w.dead&&!w.finishing&&!w.downedTicks&&!w.knockFrame&&w.side!==u.side&&w.lane===u.lane&&(w.x-u.x)*u.dir>=0&&(w.x-u.x)*u.dir<hit.range*2).sort((a,b)=>(a.x-b.x)*u.dir).slice(0,d.heavy?2:1);for(const w of victims){const resist=[0,5].includes(w.type)||this.def(w).elephant;w.x+=u.dir*(resist?6:d.heavy?35:18);}return;}
  this.pushNative(v,u.dir*Math.min(power,50));
 }
 impact(u,hit){
  const v=this.victim(u.targetId);if(!v||v.dead||v.finishing||v.downedTicks||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane||!v.castle&&this.meleeDistance(u,v)>hit.range*2)return;
  const power=(hit.original?hit.power:this.boost(hit.power,u.owner,u.type,'attack'))/(u.weak?3:1);const before=v.hp;this.hurt(v,this.int(power/2),u,false,'melee');this.nativeHit(u,v,before-v.hp);
  if(v.castle)return;
  if(!v.dead){if(this.int(100)>power||this.def(v).genericAnimations===false||this.has(v.owner,v.type,40))this.pushNative(v,u.dir*power);else this.knock(v);}
 }
 knock(v){if(v.dead||v.fleeing||v.finishing||v.downedTicks||this.def(v).genericAnimations===false)return;v.knockFrame=1;v.fallSpeed=50;v.moving=false;v.shield=false;v.targetId=null;v.specialLevel=1;}
 fireMagic(u,kind){const v=this.units.find(v=>v.id===u.targetId);if(!v||v.dead||v.finishing||v.downedTicks||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane)return;
  this.projectiles.push({id:this.nextId++,owner:u.owner,side:u.side,dir:u.dir,kind,lane:u.lane,x:u.x,y:MAGIC_FLIGHT.height,vx:MAGIC_FLIGHT.speed*u.dir,vy:kind==='bolt'?4*(this.random()-this.random()):0,targetId:v.id,firerType:u.type,age:0,frame:1});this.events.push({type:'magic'});
 }
 stepMagic(p){p.age++;if(p.frame>=3){p.frame++;if(p.frame>16)p.done=true;return;}const old=p.x;p.x+=p.vx;p.y+=p.vy;p.frame=p.frame===1?2:1;
  const v=this.units.find(v=>v.id===p.targetId);
  if(v&&!v.dead&&!v.fleeing&&!v.finishing&&!v.downedTicks&&!v.knockFrame&&v.side!==p.side&&v.lane===p.lane&&p.y>-200&&p.y<-25&&v.x>=Math.min(old,p.x)-55&&v.x<=Math.max(old,p.x)+55){
   if(!v.shield)this.hurt(v,this.int(p.kind==='orb'?175:50),p,false,'magic');if(p.kind==='orb')this.knock(v);p.frame=3;
  }else if(Math.abs(p.x)>1400||p.age>200)p.done=true;
 }
 fire(u,visual){
  if(this.fireSiege(u,visual))return;
  const d=this.def(u),v=this.victim(u.targetId);if(!v||v.dead||v.finishing||v.downedTicks||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||d.usesAmmo&&u.ammo<=0)return;if(d.usesAmmo)u.ammo--;
  const profile=({axe:[35,50],javelin:u.specialLevel>1?[50,250]:[40,150],knife:[30,50],stone:[35,50],rock:u.type===27?[35,150,-576]:[43,200,-266],skull:[50,50,-266],log:[50,100,-266],ranger:[50,50],fire:[50,200,-66],obelisk:[50,220,-266]})[visual]||[50,50];
  const rootShot=d.rootHunter&&this.tick>=(u.rootReadyAt||0);if(rootShot)u.rootReadyAt=this.tick+168;
  const velocity=profile[0];
  let range=v.x-u.x;
  if(v.moving){range=v.x+96*v.speed*v.dir-u.x;range=v.dir<0?Math.max(200,range):Math.min(-200,range);}
  let angle=Math.asin(range/(velocity*velocity))/2;if(!Number.isFinite(angle))angle=u.dir*Math.PI/4;
  // Siege engines launch above the infantry origin; include that height in
  // their ballistic solution so stones do not sail past stationary targets.
  if(visual&&visual!=='fire'){const dx=Math.abs(range),dy=-90-(profile[2]??-66),disc=velocity**4+2*dy*velocity**2-dx**2;if(disc>=0)angle=Math.sign(range)*(Math.PI/2-Math.atan2(velocity**2+Math.sqrt(disc),dx));}
  this.projectiles.push({id:this.nextId++,owner:u.owner,side:u.side,lane:u.lane,x:u.x,y:profile[2]??-66,vx:visual==='fire'?velocity*u.dir:velocity*Math.sin(angle),vy:visual==='fire'?0:-velocity*Math.cos(angle),targetId:v.id,firerType:u.type,sourceId:u.id,age:0,...(rootShot?{entangle:true}:{}),...(visual?{visual,damage:profile[1],big:['rock','skull','log','fire','obelisk'].includes(visual),dir:u.dir}: {})});
  this.events.push({type:'bow'});
 }
 move(u,ev){
  if(this.def(u).medic){const patient=this.healFollowTarget(u);if(patient){const dx=patient.x-u.x,gap=Math.max(0,Math.abs(dx)-100),step=Math.min(gap,this.boost(this.def(u).speed*2,u.owner,u.type,'speed')*this.slowFactor(u));u.x+=Math.sign(dx)*step;u.moving=step>0;return;}}

  let amount=this.boost(ev.moveAmount??u.speed*(ev.moveFactor??1),u.owner,u.type,'speed')*this.slowFactor(u);if(u.weak)amount=Math.sign(amount)*Math.min(2,Math.abs(amount));
  // Original SWF frame_3/DoAction_2.as, moveman: contact at 50,
  // full-speed knockdown, then momentum decays on every contact frame.
  if([4,6].includes(u.type)&&amount>0){const blocker=this.target(u,50);
   if(blocker&&!blocker.castle){u.targetId=blocker.id;u.x+=amount*u.dir;this.pushNative(blocker,amount*u.dir);u.moving=true;
    if(u.speed*this.slowFactor(u)>=30){u.speed=1;this.int(u.speed);this.knock(blocker,u);}
    u.speed/=1.099971389770508;return;}}
  u.moving=true;const v=this.target(u,50);if(v?.castle&&this.def(u).ram&&u.speed>=0){u.moving=false;return;}u.x+=amount*u.dir;
  if(v&&!v.castle&&(!this.def(u).ranged||!this.def(v).ranged))this.pushNative(v,amount*u.dir);
 }
 stepExit(u){
  const d=this.def(u),atlas=C.finishedAtlas?.[u.race+'-'+u.type];
  u.x+=u.dir*u.exitSpeed;u.moving=true;
  if(atlas)u.finishedFrame=u.finishedFrame%atlas.frames+1;
  else {const e=d.frames[u.frame]||{};u.frame=e.reset||e.ready?d.labels.walk:(e.jump??u.frame+1);if(u.frame>d.totalFrames)u.frame=d.labels.walk;}
  const layout=typeof module!=='undefined'?require('./layout.js'):g.BATTLE_LAYOUT;
  const x=layout.worldX(u.x,u.lane);if(x< -40||x>740)u.exited=true;
 }
 stepUnit(u){
  if(u.finishing){this.stepExit(u);return;}if(this.stepStatus(u))return;
  if(!u.dead&&[4,6].includes(u.type)&&this.fort(u)&&Math.abs(this.fort(u).x-u.x)<100&&!u.dismounting){u.dismounting=true;u.frame=this.def(u).labels.getoff;}
  if(u.dismounting&&!u.dead){if(u.frame>=(u.type===4?96:109))this.dismount(u);else u.frame++;return;}
  if(u.flash>0)u.flash--;
  const d=this.def(u);
  if(u.downedTicks){const passed=this.units.some(v=>v.side!==u.side&&v.lane===u.lane&&!v.dead&&!v.fleeing&&!v.finishing&&!v.exited&&!v.downedTicks&&!v.knockFrame&&(v.x-u.x)*u.dir<0);
   if(passed){u.downedTicks=0;this.hurt(u,1,{owner:u.reviveAttacker,side:1-u.side,lane:u.lane});}
   else if(--u.downedTicks===0){u.hp=u.maxHp*.3;u.frame=d.labels.ready||1;u.targetId=null;}
   return;}
  if(u.climbFrame||u.enterFrame){const key=u.climbFrame?'climb':'enter',prop=key+'Frame';if(++u[prop]>C.atlas[u.race+'-'+key].frames){if(key==='climb')this.siege.score+=300;u.exited=true;}return;}
  if(u.dead){u.ageDead++;if(!u.stopped){const ev=d.frames[u.frame]||{};if(ev.stop)u.stopped=true;else u.frame++;}return;}
  if(u.knockFrame){
   if(u.knockFrame<=38){u.x-=u.dir*u.fallSpeed;u.fallSpeed/=1.099971389770508;}
   if(u.knockFrame===38&&this.random()<0.8999971389770508)u.knockFrame=35;
   else if(u.knockFrame>=48){u.knockFrame=0;u.fallSpeed=0;u.frame=1;u.ammo=10;u.targetId=null;u.specialLevel=1;}
   else u.knockFrame++;
   return;
  }
  const e=d.frames[u.frame]||{};
  if(e.retreatIfCloserThan!==undefined){const v=this.victim(u.targetId);if(v&&!v.dead&&!v.finishing&&!v.exited&&v.side!==u.side&&Math.abs(v.x-u.x)<e.retreatIfCloserThan){u.frame=d.labels.bswipe;u.moving=false;return;}}
  if(u.spellId&&!u.spellDone&&u.frame===C.spells[u.spellId].frame){this.resolveSpell(u);if(u.spellId===15)return;}
  if(e.accelerate)u.speed=Math.min(d.maxSpeed??30,u.speed+e.accelerate);
  if(e.speed!==undefined)u.speed=(u.type===0||d.stoneGuard)&&e.speed===5?d.speed:e.speed;
  if(e.speedDivisor)u.speed/=e.speedDivisor;
  if(e.resetSpecial)u.specialLevel=1;
  if(e.shield!==undefined)u.shield=e.shield;
  if(e.ready||e.reset){this.decide(u);return;}
  if(e.ammoCheck&&u.ammo<=0){u.frame=d.labels.walk;return;}
  if(e.move||([1,31,101].includes(u.type)||d.brander)&&e.shield===true){if(d.ram&&u.speed<20)u.speed+=.25;this.move(u,e);}else u.moving=false;
  if(e.supportCast)this.nativeCast(u);if(e.heal)this.heal(u);
  if(e.hit)this.attack(u,e.hit);
  if(e.impact&&typeof e.impact==='object')this.impact(u,e.impact);
  if(d.ram&&u.frame===22)this.ramStrike(u);
  if(e.arrow&&!u.spellId){if(u.hookPending)this.releaseHook(u);else if(['bolt','orb'].includes(e.projectile))this.fireMagic(u,e.projectile);else this.fire(u,e.projectile);}
  if(u.type===38&&!u.spellId&&u.frame===66)this.fireMagic(u,'bolt');
  if(e.placeLadder&&this.fort(u)){this.siege.ladders[u.lane]=true;u.x=u.dir*1150;u.climbFrame=1;return;}
  u.frame=e.jump??u.frame+1;
  if(u.frame>(d.totalFrames||C.atlas['human-'+u.type].frames))u.frame=1;
  if(this.fort(u)&&this.siege.ladders[u.lane]&&d.genericAnimations&&u.x*u.dir>=1150){u.climbFrame=1;u.x=u.dir*1150;return;}
  if(u.x*u.dir>1450){
   if(this.fort(u)){this.siege.score+=100;u.exited=true;}
   else {this.scores[u.side]++;u.finishing=true;u.targetId=null;u.shield=false;u.knockFrame=0;u.fallSpeed=0;
    u.finishedFrame=C.finishedAtlas?.[u.race+'-'+u.type]?1:0;u.exitSpeed=u.finishedFrame?15:Math.max(10,u.speed*2);u.frame=d.labels.walk;}
   this.events.push({type:'score',side:u.side});
  }
 }
 ai(side){
  const p=this.players[side],team=this.options.teams[side],roster=this.roster(side),enemy=this.units.filter(u=>u.side!==team&&!u.dead&&!u.finishing&&!u.knockFrame),own=this.units.filter(u=>u.side===team&&!u.dead&&!u.finishing&&!u.knockFrame);
  let found=false,changed=false;
  for(let lane=0;lane<8;lane++){
   if(enemy.filter(u=>u.lane===lane).length-own.filter(u=>u.lane===lane).length>0){
    if(p.lane!==lane){p.lane=lane;changed=true;}found=true;if(this.random()>0.6)break;
   }
  }
  if(this.random()>0.97){if(!found){p.lane=this.int(8);p.selected=roster[this.int(roster.length)];}changed=true;}
  if(changed&&p.allowChange){
   p.allowChange=false;const foes=enemy.filter(u=>u.lane===p.lane).sort((a,b)=>side===1?b.x-a.x:a.x-b.x);const front=foes[0];
   let choices=[];
   if(front){
    const kinds=foes.reduce((o,u)=>(o[u.type]=(o[u.type]||0)+1,o),{});
    const common=this.random()>0.7?Number(Object.keys(kinds).sort((a,b)=>kinds[b]-kinds[a])[0]):front.type;
    choices=this.random()*100<this.options.difficulty?C.units[common].counters.filter(x=>roster.includes(x)):roster.filter(x=>C.units[x].counters.includes(common));
    choices=choices.filter(x=>!C.units[x].ranged||Math.abs((side===0?-1400:1400)-front.x)>C.units[x].range/2);
   }
   p.selected=choices.length?choices[this.int(choices.length)]:roster[this.int(roster.length)];
  }
  p.special=this.canSpecial(side);if(p.rallyKills>=RALLY_KILLS&&this.random()*100<this.options.difficulty)this.rally(side);else this.send(side);
 }
 step(){
  if(this.winner!==null)return;
  this.events=[];
  for(const p of this.players){p.charge++;if(this.options.mode==='watch'||(this.options.mode==='solo'&&p.side===1))this.ai(p.side);else if(p.auto&&p.rallyKills<RALLY_KILLS)this.send(p.side);}
  const existing=[...this.units];for(const u of existing)this.stepUnit(u);
  for(const p of this.projectiles){
   if(p.siegeShot){this.stepSiegeProjectile(p);continue;}
   if(p.kind==='heal'){this.stepHeal(p);continue;}
   if(p.kind){this.stepMagic(p);continue;}
   const oldX=p.x;p.age++;p.x+=p.vx;p.y+=p.vy;if(p.visual!=='fire')p.vy+=1;
   let v=this.victim(p.targetId);
   if(v&&!v.castle&&!v.dead&&!v.fleeing&&!v.finishing&&!v.downedTicks&&!p.big&&!p.visual){const dir=p.vx>=0?1:-1,guards=this.units.filter(g=>g.type===101&&g.side===v.side&&g.lane===p.lane&&g.shield&&!g.dead&&!g.finishing&&!g.downedTicks&&!g.knockFrame&&(v.x-g.x)*dir>=0&&(v.x-g.x)*dir<=200&&g.x>=Math.min(oldX,p.x)-55&&g.x<=Math.max(oldX,p.x)+55);if(guards.length)v=guards.sort((a,b)=>(a.x-b.x)*dir)[0];}
   // Approximation of Flash hitTest: fixed bounds; kept isolated for later pixel-shape parity.
   if(v&&!v.dead&&!v.fleeing&&!v.finishing&&!v.downedTicks&&!v.knockFrame&&v.side!==p.side&&p.y>-200&&p.y<-25&&(v.castle?p.vy>=0:v.x>=Math.min(oldX,p.x)-55&&v.x<=Math.max(oldX,p.x)+55)){
    if((!v.shield||p.big)&&(!v.castle||p.big)){const d=C.units[p.firerType];let dmg=this.int(this.boost(p.damage??(d.rootHunter?30:50),p.owner??p.side,p.firerType,'attack'));if(d.hooker)dmg*=.7;if(this.victim(p.sourceId)?.weak)dmg/=3;if(d.bonusAgainst.includes(v.type))dmg*=1+d.bonus/100;if(v.castle)dmg*=4;this.hurt(v,dmg,{side:p.side,owner:p.owner??p.side,lane:p.lane});if(p.entangle)this.entangle(v);if(!v.castle&&(p.visual==='stone'&&this.random()<.2||this.has(p.owner,p.firerType,34)&&this.random()<.09999815225601197))this.knock(v);}p.done=true;
   }
   if(p.y>-35&&p.age>8||p.age>200)p.done=true;
  }
  this.stepEffects();
  this.projectiles=this.projectiles.filter(p=>!p.done);
  this.units=this.units.filter(u=>!u.exited&&u.ageDead<224);
  this.tick++;
  const diff=this.scores[0]-this.scores[1];
  if(this.options.mode==='coop')return;
  if(this.siege){if(this.siege.score>=this.siege.target)this.winner=1-this.siege.side;else if(this.scores[this.siege.side]>=25||this.tick>=7200)this.winner=this.siege.side;return;}
  if(diff>=25)this.winner=0;else if(diff<=-25)this.winner=1;else if(this.tick>=7200&&diff!==0)this.winner=diff>0?0:1;
 }
 snapshot(){return JSON.parse(JSON.stringify({format:'warlords2-remake-battle',version:6,nativeWeaponRevision:1,options:this.options,rng:this.rng,tick:this.tick,nextId:this.nextId,units:this.units,effects:this.effects,projectiles:this.projectiles,players:this.players,scores:this.scores,winner:this.winner,commands:this.commands,hits:this.hits,siege:this.siege}));}
 static restore(input){
  const s=structuredClone(input),o=s?.options,n=o?.mode==='coop'?o.races?.length:2;
  if(!s||s.format!=='warlords2-remake-battle'||![1,2,3,4,5,6].includes(s.version)||!Number.isInteger(s.tick)||s.tick<0||s.tick>1000000||!Array.isArray(s.units)||s.units.length>3000||!Array.isArray(s.projectiles)||s.projectiles.length>10000||!Array.isArray(s.players)||s.players.length!==n||!Array.isArray(s.scores)||s.scores.length!==2||!Array.isArray(s.commands)||s.commands.length>100000)throw Error('存档格式不正确或版本不兼容');
  if(!o||!Number.isInteger(n)||n<2||n>Object.keys(C.races).length+2||o.mode==='coop'&&n<3||!['solo','duel','watch','coop'].includes(o.mode)||!Array.isArray(o.races)||o.races.length!==n||!o.races.every(x=>Object.hasOwn(C.races,x))||!['forest','plains','waste','snow','demonland','desert','stone','goldenforest'].includes(o.terrain))throw Error('存档的对战设置不正确');
  if(o.mercenaries!==undefined&&(o.mercenaries!==true||o.mode!=='coop'||o.siege))throw Error('invalid recruitment mode');
  if(o.retiredRosters!==undefined&&(!o.mercenaries||!Array.isArray(o.retiredRosters)||o.retiredRosters.length!==n||!o.retiredRosters.every((r,i)=>Array.isArray(r)&&r.length<=ORDER.length&&r.every(id=>P.recruitRoster({race:o.races[i],mercenaries:i<2}).includes(id)))))throw Error('invalid retired troops');
  // Old stone guards used the spear timeline. Map their saved pose to the axe timeline once.
  if(s.nativeWeaponRevision===undefined)for(const u of s.units)if(u?.type===111&&Number.isInteger(u.frame)&&u.frame>=1&&u.frame<=149){const f=u.frame;u.frame=f<3?1:f<=60?f+19:f<=75?f+31:f<=90?f+31:f<=105?f+1:f<=117?f-26:f<=128?f+4:f<=147?Math.min(147,f+4):1;}
  if(s.version===1)o.rosters=[LEGACY_ORDER.slice(),LEGACY_ORDER.slice()];
  if(s.version<3){o.teams=[0,1];o.upgrades=[{},{}];for(const p of s.players)p.special=false;for(const u of s.units){u.owner=u.side;u.specialLevel=1;u.castCount=0;}for(const p of s.projectiles)p.owner=p.side;}
  const teams=o.mode==='coop'?o.races.map((_,i)=>i<2?0:1):[0,1],rosters=o.rosters;
  if(JSON.stringify(o.teams)!==JSON.stringify(teams)||!Array.isArray(o.upgrades)||o.upgrades.length!==n||!o.upgrades.every((u,i)=>P.armyUpgrades({race:o.races[i],mercenaries:o.mercenaries===true&&i<2,upgrades:u})))throw Error('存档的阵营或升级不正确');
  if(!Array.isArray(rosters)||rosters.length!==n||!rosters.every((r,i)=>Array.isArray(r)&&r.length>0&&r.length<=(o.mode==='coop'&&i>=2?C.races[o.races[i]].roster.length:10)&&new Set(r).size===r.length&&r.every(id=>P.recruitRoster({race:o.races[i],mercenaries:o.mercenaries===true&&i<2}).includes(id))))throw Error('存档的兵种配置不正确');
  if(![s.rng,s.nextId,s.hits,...s.scores].every(x=>Number.isFinite(x)&&x>=0)||![null,0,1].includes(s.winner))throw Error('存档的战斗状态不正确');
  if(o.siege&&(![0,1].includes(o.siege.side)||o.siege.target!==7500||!s.siege||s.siege.side!==o.siege.side||s.siege.target!==7500||!Number.isFinite(s.siege.score)||s.siege.score<0||s.siege.score>100000||!Array.isArray(s.siege.ladders)||s.siege.ladders.length!==8||!s.siege.ladders.every(x=>typeof x==='boolean'))||!o.siege&&s.siege)throw Error('攻城存档不正确');
  if(s.version<5)for(const p of s.players)p.rallyKills=Math.min(RALLY_KILLS,p.kills);
  if(s.version<6){s.effects=[];for(const p of s.players)p.killReward??=p.kills*5;}
  Battle.validateRestoration(s,C);
  const ids=new Set();
  const statusCaps={healReadyAt:HEAL_COOLDOWN,healLockUntil:96,healPulseUntil:24,rootReadyAt:168,slowUntil:48,rootImmuneUntil:120};
  for(const u of s.units)for(const [key,cap]of Object.entries(statusCaps))if(u[key]!==undefined&&(!Number.isInteger(u[key])||u[key]<0||u[key]>s.tick+cap||key==='healReadyAt'&&u.type!==105||key==='rootReadyAt'&&u.type!==106))throw Error('支援兵状态不正确');
  for(const p of s.projectiles)if(p.kind==='heal'){
   // Migrate local prototype saves that used a fixed-duration, interpolated flight.
   if(p.fromX!==undefined){if(!Number.isFinite(p.fromX))throw Error('治疗光球状态不正确');const v=s.units.find(u=>u.id===p.targetId);p.dir=Math.sign((v?.x??p.x+p.dir)-p.x)||p.dir;p.vx=MAGIC_FLIGHT.speed*p.dir;p.vy=0;p.y=MAGIC_FLIGHT.height;p.frame=1;delete p.fromX;}
   if(p.firerType!==105||!Number.isInteger(p.age)||p.age<0||p.age>200||Math.abs(p.vx)!==MAGIC_FLIGHT.speed||p.vy!==0||p.y!==MAGIC_FLIGHT.height)throw Error('治疗光球状态不正确');
  }
  for(const p of s.projectiles)if(p.entangle!==undefined&&(p.entangle!==true||p.firerType!==106))throw Error('缚根箭状态不正确');
  for(const u of s.units){
   if(u.downedTicks!==undefined&&(!Number.isInteger(u.downedTicks)||u.downedTicks<0||u.downedTicks>72||u.type!==102)||u.reviveUsed!==undefined&&(typeof u.reviveUsed!=='boolean'||u.type!==102))throw Error('重整状态不正确');
   if(!ORDER.includes(u.type)||!Number.isInteger(u.owner)||u.owner<0||u.owner>=n||u.side!==teams[u.owner]||u.race!==(u.summoned?'undead':P.unitRace({race:o.races[u.originOwner??u.owner],mercenaries:o.mercenaries===true&&(u.originOwner??u.owner)<2},u.type))||!C.atlas[u.race+'-'+u.type]||!u.summoned&&![...rosters[u.originOwner??u.owner],...(o.retiredRosters?.[u.originOwner??u.owner]||[])].includes(u.dismountedFrom??u.type)||u.dir!==(u.side===0?1:-1)||!Number.isInteger(u.lane)||u.lane<0||u.lane>7||![u.id,u.x,u.hp,u.maxHp,u.speed,u.frame,u.ageDead,u.ammo,u.castCount].every(Number.isFinite)||u.frame<1||u.frame>C.units[u.type].totalFrames||u.maxHp<=0||ids.has(u.id)||![1,2].includes(u.specialLevel)||u.castCount<0||u.castCount>10||u.knockFrame!==undefined&&(!Number.isInteger(u.knockFrame)||u.knockFrame<0||u.knockFrame>48||!Number.isFinite(u.fallSpeed)))throw Error('存档的单位数据不正确');
   if(u.finishing!==undefined&&(u.finishing!==true||u.dead||!Number.isFinite(u.exitSpeed)||u.exitSpeed<=0||u.exitSpeed>200||!Number.isInteger(u.finishedFrame)||u.finishedFrame<0||u.finishedFrame>(C.finishedAtlas?.[u.race+'-'+u.type]?.frames||0)))throw Error('离场状态不正确');
   ids.add(u.id);
   for(const key of ['climb','enter'])if(u[key+'Frame']!==undefined&&(!s.siege||!Number.isInteger(u[key+'Frame'])||u[key+'Frame']<1||u[key+'Frame']>C.atlas[u.race+'-'+key].frames))throw Error('攀城状态不正确');
  }
  for(const p of s.projectiles)if(p.siegeShot!==undefined&&(p.siegeShot!==true||![21,23,24,27,28,30,47].includes(p.firerType)||p.visual!==C.units[p.firerType].projectile||!Number.isFinite(p.rotation)||!Number.isFinite(p.alpha)||p.alpha<0||p.alpha>1||!Number.isInteger(p.frame)||p.frame<1||p.frame>C.projectileAtlas[p.visual].frames||p.phase!==undefined&&!['rise','fall','impact'].includes(p.phase)||p.hit!==undefined&&typeof p.hit!=='boolean'||p.bouncing!==undefined&&(typeof p.bouncing!=='boolean'||!Number.isFinite(p.spin))))throw Error('攻城弹道状态不正确');
  for(const p of s.projectiles)if(p.visual&&(!C.projectileAtlas[p.visual]||!Number.isFinite(p.damage)||p.damage<0||p.damage>1000||typeof p.big!=='boolean'||p.dir!==(p.side===0?1:-1))||p.targetId<0&&(!s.siege||p.targetId<-8))throw Error('投射物状态不正确');
  for(const p of s.projectiles)if(!Number.isInteger(p.owner)||p.owner<0||p.owner>=n||p.side!==teams[p.owner]||!ORDER.includes(p.firerType)||![p.id,p.x,p.y,p.vx,p.vy,p.age,p.targetId].every(Number.isFinite)||!Number.isInteger(p.lane)||p.lane<0||p.lane>7||p.kind&&(!['bolt','orb','heal'].includes(p.kind)||!Number.isInteger(p.frame)||p.frame<1||p.frame>16||(p.kind==='heal'?![-1,1].includes(p.dir):p.dir!==(p.side===0?1:-1))))throw Error('存档的弹道数据不正确');
  for(const [owner,p] of s.players.entries())if(p.side!==owner||!rosters[owner].includes(p.selected)||!Number.isInteger(p.lane)||p.lane<0||p.lane>7||![p.charge,p.kills,p.spawned,p.killReward].every(x=>Number.isFinite(x)&&x>=0)||!Number.isInteger(p.rallyKills)||p.rallyKills<0||p.rallyKills>RALLY_KILLS||typeof p.auto!=='boolean'||typeof p.special!=='boolean')throw Error('存档的出兵数据不正确');
  const b=new Battle(o);for(const k of ['rng','tick','nextId','units','projectiles','players','scores','winner','commands','hits'])b[k]=s[k];b.siege=s.siege??null;b.effects=s.effects||[];return b;
 }

}
(typeof module!=='undefined'?require('./restoration-engine.js'):g.installRestoration)(Battle,C);
(typeof module!=='undefined'?require('./native-reinforcements-engine.js'):g.installNativeReinforcements)(Battle,C);
(typeof module!=='undefined'?require('./siege-engine.js'):g.installSiege)(Battle,C);
const api={Battle,ORDER,FPS,MAGIC_FLIGHT,RALLY_KILLS,HEAL_COOLDOWN};if(typeof module!=='undefined')module.exports=api;else g.Warlords=api;
})(globalThis);

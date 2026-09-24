/* Independent fixed-step battle simulation. No renderer or Flash dependency. */
(function(g){
'use strict';
const C=typeof module!=='undefined'?require('./content.js'):g.CONTENT;
if(typeof module!=='undefined')require('./balance.js')(C);
const P=typeof module!=='undefined'?require('./progression.js'):g.Progression;
const LEGACY_ORDER=[0,1,2,5],ORDER=C.order||LEGACY_ORDER, FPS=24;
class Battle{
 constructor(options={}){
  this.options={seed:1234567,mode:'solo',races:['human','orc'],difficulty:60,terrain:'forest',...options};
  this.options.rosters=this.options.races.map((race,side)=>[...(options.rosters?.[side]||C.races?.[race]?.roster.slice(0,10)||LEGACY_ORDER)]);
  this.options.teams=this.options.mode==='coop'?[0,0,1]:[0,1];
  this.options.upgrades=this.options.races.map((race,i)=>structuredClone(options.upgrades?.[i]||{}));
  this.rng=this.options.seed>>>0||1;this.tick=0;this.nextId=1;this.units=[];this.projectiles=[];this.effects=[];
  this.players=this.options.races.map((race,side)=>({side,lane:3,selected:this.options.rosters[side][0],charge:0,auto:false,special:false,allowChange:true,kills:0,spawned:0}));
  this.scores=[0,0];this.winner=null;this.commands=[];this.events=[];this.hits=0;
  this.siege=this.options.siege?{side:this.options.siege.side,target:this.options.siege.target,score:0,ladders:Array(8).fill(false)}:null;
 }
 random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
 int(n){return Math.floor(this.random()*n);}
 def(u){return C.units[u.type];}
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
  if(type==='select'&&!this.roster(side).includes(value)||type==='lane'&&(!Number.isInteger(value)||value<0||value>7)||['auto','special'].includes(type)&&typeof value!=='boolean'||type==='special'&&value&&!this.canSpecial(side)||!['select','lane','send','auto','special'].includes(type))return false;
  if(record)this.commands.push({tick:this.tick,side,type,value});
  if(type==='select'){p.selected=value;if(!this.canSpecial(side,value))p.special=false;}
  if(type==='lane')p.lane=value;
  if(type==='auto')p.auto=value;
  if(type==='special')p.special=value;
  if(type==='send')return this.send(side);
  return true;
 }
 send(side){const p=this.players[side],d=C.units[p.selected];if(p.charge<this.chargeNeeded(side))return false;
  const special=this.canSpecial(side)&&p.charge>=2*d.charge;this.spawn(side,p.selected,p.lane,undefined,special);p.charge=0;p.allowChange=true;return true;
 }
 spawn(owner,type,lane,x,special=false){
  const side=this.options.teams[owner],d=C.units[type],health=this.boost(d.health,owner,type,'armour'),u={id:this.nextId++,owner,side,type,lane,race:this.options.races[owner],dir:side===0?1:-1,x:x??(side===0?-1400:1400),hp:health,maxHp:health,speed:d.speed+this.random()/2,frame:1,dead:false,ageDead:0,stopped:false,targetId:null,moving:false,ammo:10,shield:false,flash:0,specialLevel:special&&this.canSpecial(owner,type)?2:1,castCount:0};
  this.units.push(u);this.players[owner].spawned++;this.events.push({type:'spawn',unit:type,side});return u;
 }
 target(u,range){
  const d=this.def(u),r=range??d.range*2;
  let best=null,dist=Infinity;
  for(const v of this.units){if(v.dead||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane)continue;
   const dx=(v.x-u.x)*u.dir,ab=Math.abs(v.x-u.x);
   if(dx>=0&&ab<r&&(!d.ranged||ab>r/2)&&ab<dist){best=v;dist=ab;}
  }
  const fort=this.fort(u);
  if(!best&&fort&&Math.abs(fort.x-u.x)<r&&(!d.ranged||!d.genericAnimations)&&(!this.siege.ladders[u.lane]||!d.genericAnimations))return fort;
  return best;
 }
 decide(u){
  const d=this.def(u);u.moving=false;
  if(d.caster&&this.has(u.owner,u.type,17)&&u.castCount<10&&this.random()>0.7999852180480957){
   const target=this.units.find(v=>!v.dead&&!v.knockFrame&&v.side!==u.side&&v.lane===u.lane&&(v.x-u.x)*u.dir>300&&(v.x-u.x)*u.dir<5000);
   if(target){u.targetId=target.id;u.castCount++;u.frame=d.labels.spell4;return;}
  }
  const v=this.target(u);u.targetId=v?.id??null;
  if(v?.castle&&u.type===19){u.frame=d.labels.placeladder;return;}
  if(v&&this.random()>0.1999966621398926&&(!d.usesAmmo||u.ammo>0))u.frame=u.specialLevel>1&&d.labels.specialattack?d.labels.specialattack:d.labels['swipe'+(this.int(d.swipes)+1)];
  else u.frame=u.specialLevel>1&&d.labels.special?d.labels.special:d.labels.walk;
 }
 hurt(v,amount,attacker){
  if(v.castle){this.siege.score+=Math.min(200,Math.max(0,amount));this.events.push({type:'hit',side:attacker?.side??0});return;}
  if(v.dead)return;v.hp-=amount;v.flash=3;this.hits++;this.events.push({type:'hit',side:attacker?.side??0});
  if(v.hp<=0){v.hp=0;v.dead=true;v.stopped=false;v.frame=this.def(v).labels.die1;v.ageDead=0;const credit=attacker?.owner??this.options.teams.findIndex(team=>team!==v.side);if(this.players[credit])this.players[credit].kills++;}
 }
 attack(u,hit){
  const v=this.victim(u.targetId);if(!v||v.dead||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane||!v.castle&&Math.abs(v.x-u.x)>hit.range*2)return;
  const d=this.def(u);let power=this.boost(hit.power,u.owner,u.type,'attack');
  if(v.castle){if(d.big)this.hurt(v,this.int(power),u);else if((u.wallHits=(u.wallHits||0)+1)>10){u.enterFrame=1;u.x=u.dir*1400;this.siege.score+=150;}return;}
  if(d.bonusAgainst.includes(v.type))power*=1+d.bonus/100;
  if(!v.shield)this.hurt(v,this.int(power),u);
  v.x+=u.dir*Math.min(power,50);
 }
 impact(u,hit){
  const v=this.victim(u.targetId);if(!v||v.dead||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane||!v.castle&&Math.abs(v.x-u.x)>hit.range*2)return;
  const power=this.boost(hit.power,u.owner,u.type,'attack');this.hurt(v,this.int(power/2),u);
  if(v.castle)return;
  if(!v.dead){if(this.int(100)>power||this.def(v).genericAnimations===false||this.has(v.owner,v.type,40))v.x+=u.dir*power;else this.knock(v);}
 }
 knock(v){if(v.dead||this.def(v).genericAnimations===false)return;v.knockFrame=1;v.fallSpeed=50;v.moving=false;v.shield=false;v.targetId=null;v.specialLevel=1;}
 fireMagic(u,kind){const v=this.units.find(v=>v.id===u.targetId);if(!v||v.dead||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||v.lane!==u.lane)return;
  this.projectiles.push({id:this.nextId++,owner:u.owner,side:u.side,dir:u.dir,kind,lane:u.lane,x:u.x,y:-66,vx:60*u.dir,vy:kind==='bolt'?4*(this.random()-this.random()):0,targetId:v.id,firerType:u.type,age:0,frame:1});this.events.push({type:'magic'});
 }
 stepMagic(p){p.age++;if(p.frame>=3){p.frame++;if(p.frame>16)p.done=true;return;}const old=p.x;p.x+=p.vx;p.y+=p.vy;p.frame=p.frame===1?2:1;
  const v=this.units.find(v=>v.id===p.targetId);
  if(v&&!v.dead&&!v.knockFrame&&v.side!==p.side&&v.lane===p.lane&&p.y>-200&&p.y<-25&&v.x>=Math.min(old,p.x)-55&&v.x<=Math.max(old,p.x)+55){
   if(!v.shield)this.hurt(v,this.int(p.kind==='orb'?175:50),p);if(p.kind==='orb')this.knock(v);p.frame=3;
  }else if(Math.abs(p.x)>1400||p.age>200)p.done=true;
 }
 fire(u,visual){
  const d=this.def(u),v=this.victim(u.targetId);if(!v||v.dead||v.knockFrame||v.climbFrame||v.enterFrame||v.side===u.side||d.usesAmmo&&u.ammo<=0)return;if(d.usesAmmo)u.ammo--;
  const profile=({axe:[35,50],javelin:u.specialLevel>1?[50,250]:[40,150],knife:[30,50],stone:[35,50],rock:u.type===27?[35,150,-576]:[43,200,-266],skull:[50,50,-266],log:[50,100,-266],ranger:[50,50],fire:[50,200,-66],obelisk:[50,220,-266]})[visual]||[50,50];
  const velocity=profile[0];
  let range=v.x-u.x;
  if(v.moving){range=v.x+96*v.speed*v.dir-u.x;range=v.dir<0?Math.max(200,range):Math.min(-200,range);}
  let angle=Math.asin(range/(velocity*velocity))/2;if(!Number.isFinite(angle))angle=u.dir*Math.PI/4;
  // Siege engines launch above the infantry origin; include that height in
  // their ballistic solution so stones do not sail past stationary targets.
  if(visual&&visual!=='fire'){const dx=Math.abs(range),dy=-90-(profile[2]??-66),disc=velocity**4+2*dy*velocity**2-dx**2;if(disc>=0)angle=Math.sign(range)*(Math.PI/2-Math.atan2(velocity**2+Math.sqrt(disc),dx));}
  this.projectiles.push({id:this.nextId++,owner:u.owner,side:u.side,lane:u.lane,x:u.x,y:profile[2]??-66,vx:visual==='fire'?velocity*u.dir:velocity*Math.sin(angle),vy:visual==='fire'?0:-velocity*Math.cos(angle),targetId:v.id,firerType:u.type,age:0,...(visual?{visual,damage:profile[1],big:['rock','skull','log','fire','obelisk'].includes(visual),dir:u.dir}: {})});
  this.events.push({type:'bow'});
 }
 move(u,ev){
  const amount=this.boost(ev.moveAmount??u.speed*(ev.moveFactor??1),u.owner,u.type,'speed');
  u.moving=true;const v=this.target(u,50);u.x+=amount*u.dir;
  if(v&&!v.castle&&(!this.def(u).ranged||!this.def(v).ranged))v.x+=amount*u.dir;
 }
 stepUnit(u){
  if(u.flash>0)u.flash--;
  const d=this.def(u);
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
  if(e.accelerate)u.speed=Math.min(30,u.speed+e.accelerate);
  if(e.speed!==undefined)u.speed=u.type===0&&e.speed===5?d.speed:e.speed;
  if(e.speedDivisor)u.speed/=e.speedDivisor;
  if(e.resetSpecial)u.specialLevel=1;
  if(e.shield!==undefined)u.shield=e.shield;
  if(e.ready||e.reset){this.decide(u);return;}
  if(e.ammoCheck&&u.ammo<=0){u.frame=d.labels.walk;return;}
  if(e.move){if(d.ram)u.speed=Math.min(20,u.speed+.25);this.move(u,e);}else u.moving=false;
  if(e.hit)this.attack(u,e.hit);
  if(e.impact&&typeof e.impact==='object')this.impact(u,e.impact);
  if(d.ram&&e.move){const v=this.target(u,200);if(v&&u.speed>0){u.targetId=v.id;this.impact(u,{range:100,power:u.speed*10});u.speed=v.castle?-Math.max(5,u.speed):0;}}
  if(e.arrow){if(['bolt','orb'].includes(e.projectile))this.fireMagic(u,e.projectile);else this.fire(u,e.projectile);}
  if(e.placeLadder&&this.fort(u)){this.siege.ladders[u.lane]=true;u.x=u.dir*1150;u.climbFrame=1;return;}
  u.frame=e.jump??u.frame+1;
  if(u.frame>(d.totalFrames||C.atlas['human-'+u.type].frames))u.frame=1;
  if(this.fort(u)&&this.siege.ladders[u.lane]&&d.genericAnimations&&u.x*u.dir>=1150){u.climbFrame=1;u.x=u.dir*1150;return;}
  if(u.x*u.dir>1450){if(this.fort(u))this.siege.score+=100;else this.scores[u.side]++;u.exited=true;this.events.push({type:'score',side:u.side});}
 }
 ai(side){
  const p=this.players[side],team=this.options.teams[side],roster=this.roster(side),enemy=this.units.filter(u=>u.side!==team&&!u.dead&&!u.knockFrame),own=this.units.filter(u=>u.side===team&&!u.dead&&!u.knockFrame);
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
  p.special=this.canSpecial(side);this.send(side);
 }
 step(){
  if(this.winner!==null)return;
  this.events=[];
  for(const p of this.players){p.charge++;if(this.options.mode==='watch'||(this.options.mode==='solo'&&p.side===1))this.ai(p.side);else if(p.auto)this.send(p.side);}
  const existing=[...this.units];for(const u of existing)this.stepUnit(u);
  for(const p of this.projectiles){
   if(p.kind){this.stepMagic(p);continue;}
   const oldX=p.x;p.age++;p.x+=p.vx;p.y+=p.vy;if(p.visual!=='fire')p.vy+=1;
   const v=this.victim(p.targetId);
   // Approximation of Flash hitTest: fixed bounds; kept isolated for later pixel-shape parity.
   if(v&&!v.dead&&!v.knockFrame&&v.side!==p.side&&p.y>-200&&p.y<-25&&(v.castle?p.vy>=0:v.x>=Math.min(oldX,p.x)-55&&v.x<=Math.max(oldX,p.x)+55)){
    if((!v.shield||p.big)&&(!v.castle||p.big)){const d=C.units[p.firerType];let dmg=this.int(this.boost(p.damage??50,p.owner??p.side,p.firerType,'attack'));if(d.bonusAgainst.includes(v.type))dmg*=1+d.bonus/100;if(v.castle)dmg*=4;this.hurt(v,dmg,{side:p.side,owner:p.owner??p.side});if(p.visual==='stone'&&!v.castle&&this.random()<.2)this.knock(v);}p.done=true;
   }
   if(p.y>-35&&p.age>8||p.age>200)p.done=true;
  }
  this.projectiles=this.projectiles.filter(p=>!p.done);
  this.units=this.units.filter(u=>!u.exited&&u.ageDead<224);
  this.tick++;
  const diff=this.scores[0]-this.scores[1];
  if(this.options.mode==='coop')return;
  if(this.siege){if(this.siege.score>=this.siege.target)this.winner=1-this.siege.side;else if(this.scores[this.siege.side]>=25||this.tick>=7200)this.winner=this.siege.side;return;}
  if(diff>=25)this.winner=0;else if(diff<=-25)this.winner=1;else if(this.tick>=7200&&diff!==0)this.winner=diff>0?0:1;
 }
 snapshot(){return JSON.parse(JSON.stringify({format:'warlords2-remake-battle',version:4,options:this.options,rng:this.rng,tick:this.tick,nextId:this.nextId,units:this.units,projectiles:this.projectiles,players:this.players,scores:this.scores,winner:this.winner,commands:this.commands,hits:this.hits,siege:this.siege}));}
 static restore(input){
  const s=structuredClone(input),o=s?.options,n=o?.mode==='coop'?3:2;
  if(!s||s.format!=='warlords2-remake-battle'||![1,2,3,4].includes(s.version)||!Number.isInteger(s.tick)||s.tick<0||s.tick>1000000||!Array.isArray(s.units)||s.units.length>3000||!Array.isArray(s.projectiles)||s.projectiles.length>10000||!Array.isArray(s.players)||s.players.length!==n||!Array.isArray(s.scores)||s.scores.length!==2||!Array.isArray(s.commands)||s.commands.length>100000)throw Error('存档格式不正确或版本不兼容');
  if(!o||!['solo','duel','watch','coop'].includes(o.mode)||!Array.isArray(o.races)||o.races.length!==n||!o.races.every(x=>Object.hasOwn(C.races,x))||!['forest','plains','waste','snow','demonland','desert','stone','goldenforest'].includes(o.terrain))throw Error('存档的对战设置不正确');
  if(s.version===1)o.rosters=[LEGACY_ORDER.slice(),LEGACY_ORDER.slice()];
  if(s.version<3){o.teams=[0,1];o.upgrades=[{},{}];for(const p of s.players)p.special=false;for(const u of s.units){u.owner=u.side;u.specialLevel=1;u.castCount=0;}for(const p of s.projectiles)p.owner=p.side;}
  const teams=o.mode==='coop'?[0,0,1]:[0,1],rosters=o.rosters;
  if(JSON.stringify(o.teams)!==JSON.stringify(teams)||!Array.isArray(o.upgrades)||o.upgrades.length!==n||!o.upgrades.every((u,i)=>P.validUpgrades(o.races[i],u)))throw Error('存档的阵营或升级不正确');
  if(!Array.isArray(rosters)||rosters.length!==n||!rosters.every((r,i)=>Array.isArray(r)&&r.length>0&&r.length<=10&&new Set(r).size===r.length&&r.every(id=>C.races[o.races[i]].roster.includes(id))))throw Error('存档的兵种配置不正确');
  if(![s.rng,s.nextId,s.hits,...s.scores].every(x=>Number.isFinite(x)&&x>=0)||![null,0,1].includes(s.winner))throw Error('存档的战斗状态不正确');
  if(o.siege&&(![0,1].includes(o.siege.side)||o.siege.target!==7500||!s.siege||s.siege.side!==o.siege.side||s.siege.target!==7500||!Number.isFinite(s.siege.score)||s.siege.score<0||s.siege.score>100000||!Array.isArray(s.siege.ladders)||s.siege.ladders.length!==8||!s.siege.ladders.every(x=>typeof x==='boolean'))||!o.siege&&s.siege)throw Error('攻城存档不正确');
  const ids=new Set();
  for(const u of s.units){
   if(!ORDER.includes(u.type)||!Number.isInteger(u.owner)||u.owner<0||u.owner>=n||u.side!==teams[u.owner]||u.race!==o.races[u.owner]||!C.atlas[u.race+'-'+u.type]||!rosters[u.owner].includes(u.type)||u.dir!==(u.side===0?1:-1)||!Number.isInteger(u.lane)||u.lane<0||u.lane>7||![u.id,u.x,u.hp,u.maxHp,u.speed,u.frame,u.ageDead,u.ammo,u.castCount].every(Number.isFinite)||u.frame<1||u.frame>C.units[u.type].totalFrames||u.maxHp<=0||ids.has(u.id)||![1,2].includes(u.specialLevel)||u.castCount<0||u.castCount>10||u.knockFrame!==undefined&&(!Number.isInteger(u.knockFrame)||u.knockFrame<0||u.knockFrame>48||!Number.isFinite(u.fallSpeed)))throw Error('存档的单位数据不正确');
   ids.add(u.id);
   for(const key of ['climb','enter'])if(u[key+'Frame']!==undefined&&(!s.siege||!Number.isInteger(u[key+'Frame'])||u[key+'Frame']<1||u[key+'Frame']>C.atlas[u.race+'-'+key].frames))throw Error('攀城状态不正确');
  }
  for(const p of s.projectiles)if(p.visual&&(!C.projectileAtlas[p.visual]||!Number.isFinite(p.damage)||p.damage<0||p.damage>1000||typeof p.big!=='boolean'||p.dir!==(p.side===0?1:-1))||p.targetId<0&&(!s.siege||p.targetId<-8))throw Error('投射物状态不正确');
  for(const p of s.projectiles)if(!Number.isInteger(p.owner)||p.owner<0||p.owner>=n||p.side!==teams[p.owner]||!rosters[p.owner].includes(p.firerType)||![p.id,p.x,p.y,p.vx,p.vy,p.age,p.targetId].every(Number.isFinite)||!Number.isInteger(p.lane)||p.lane<0||p.lane>7||p.kind&&(!['bolt','orb'].includes(p.kind)||!Number.isInteger(p.frame)||p.frame<1||p.frame>16||p.dir!==(p.side===0?1:-1)))throw Error('存档的弹道数据不正确');
  for(const [owner,p] of s.players.entries())if(p.side!==owner||!rosters[owner].includes(p.selected)||!Number.isInteger(p.lane)||p.lane<0||p.lane>7||![p.charge,p.kills,p.spawned].every(x=>Number.isFinite(x)&&x>=0)||typeof p.auto!=='boolean'||typeof p.special!=='boolean')throw Error('存档的出兵数据不正确');
  const b=new Battle(o);for(const k of ['rng','tick','nextId','units','projectiles','players','scores','winner','commands','hits'])b[k]=s[k];b.siege=s.siege??null;return b;
 }

}
const api={Battle,ORDER,FPS};if(typeof module!=='undefined')module.exports=api;else g.Warlords=api;
})(globalThis);

'use strict';
const {CoopCampaign}=require('./coop-campaign.cjs'),{Battle}=require('../种族战役2复刻/engine'),C=require('../种族战役2复刻/content'),P=require('../种族战役2复刻/progression');
const ENEMY_RACES=Object.keys(C.races).filter(r=>r!=='persian');
const POOL=C.order.map(type=>({type,race:ENEMY_RACES.find(r=>C.races[r].roster.includes(type))})).filter(u=>u.race&&!C.units[u.type].playerOnly);
const BASIC=[0,1,2,5];
const MID=[9,11,12,13,17,18,20,22,23,26,31,32,34,35,36,37,100];
const ELITE=[4,6,8,9,10,12,13,14,17,18,20,22,26,31,32,34,35,36,37];
const MONSTERS=[16,33],SIEGE=[21,23,24,25,27,28,29,30,47];
const SPECIAL=POOL.filter(u=>!BASIC.includes(u.type)).map(u=>u.type);
function pacing(wave){return wave<=10?{count:4,special:0,seconds:18}:wave<=15?{count:5,special:0,seconds:16}:wave<=25?{count:6,special:1,seconds:14}:wave<=40?{count:8,special:2,seconds:12}:wave<=60?{count:8,special:4,seconds:10}:wave<=80?{count:8,special:6,seconds:8}:wave<=100?{count:8,special:8,seconds:7}:wave<=150?{count:8,special:8,seconds:6}:wave<=200?{count:8,special:8,seconds:5}:{count:8,special:8,seconds:Math.max(2.5,4-Math.floor((wave-201)/50)*.5)};}
function director(){return {pressure:0,nextTick:720,scores:[0,0],kills:0,safeSamples:0,reliefUntil:0};}
class CoopEndless extends CoopCampaign {
 constructor(options={}){super(options);this.solo=options.solo===true;this.halfCarry=0;this.specialCarry=0;this.mode='endless';this.armies.forEach(a=>{a.gold=3000;a.mercenaries=true;});this.nextAt=144;this.deck=[];this.cursor=0;this.shopOffer=null;this.intermission=false;this.rewardTotal=0;this.director=director();this.defense=50;this.defenseScores=[0,0];}
 level(){return {name:'无尽守卫',enemyRaces:ENEMY_RACES,enemyRace:ENEMY_RACES[0],terrain:'plains',lives:50,target:null,reward:0,firstWaveAt:144,waveInterval:this.wavePlan(Math.max(1,this.wave)).seconds*24};}
 command(owner,type,value){
  if(!Number.isInteger(owner)||owner<0||owner>1||this.solo&&owner!==0)return false;if(this.solo&&type==='ready')this.ready[1]=true;if(this.solo&&type==='shopVote'&&this.shopOffer)this.shopOffer.votes[1]=true;
  if(type==='buyUnit'&&this.wave<15&&!C.races[this.armies[owner].race].roster.includes(value))return false;
  if(type==='shopVote'&&this.phase==='battle'&&this.shopOffer&&typeof value==='boolean'){
   if(!value){this.shopOffer=null;return true;}
   this.shopOffer.votes[owner]=true;if(this.shopOffer.votes.every(Boolean)){this.phase='shop';this.intermission=true;this.ready=[false,false];this.shopOffer=null;}return true;
  }
  if(type==='retry'&&this.phase==='failed'){this.intermission=false;this.shopOffer=null;}
  return super.command(owner,type,value);
 }
 begin(){if(this.intermission){
  const b=this.battle;for(let i=0;i<2;i++){b.options.retiredRosters??=b.options.races.map(()=>[]);b.options.retiredRosters[i]=[...new Set([...b.options.retiredRosters[i],...b.options.rosters[i]])];b.options.rosters[i]=this.armies[i].roster.slice();b.options.upgrades[i]=structuredClone(this.armies[i].upgrades);const p=b.players[i];if(!b.roster(i).includes(p.selected)){p.selected=b.roster(i)[0];p.charge=0;}p.special=false;}
  this.battle=Battle.restore(b.snapshot());this.phase='battle';this.intermission=false;this.ready=[false,false];return;
 }this.halfCarry=0;this.specialCarry=0;this.shopOffer=null;this.rewardTotal=0;this.director=director();this.defense=50;this.defenseScores=[0,0];const l=this.level();this.battle=new Battle({seed:this.seed,mode:'coop',mercenaries:true,races:[...this.armies.map(a=>a.race),...ENEMY_RACES],rosters:[...this.armies.map(a=>a.roster),...ENEMY_RACES.map(r=>POOL.filter(u=>u.race===r).map(u=>u.type))],upgrades:[...this.armies.map(a=>a.upgrades),...ENEMY_RACES.map(()=>({}))],terrain:l.terrain});this.phase='battle';this.wave=0;this.nextAt=144;this.deck=[];this.cursor=0;this.ready=[false,false];this.lastResult=null;}
 wavePlan(wave){
  const base=pacing(wave),p=Math.min(this.director.pressure,wave<=40?2:6),count=wave>40?8:Math.max(2,Math.min(8,base.count+p));
  const special=Math.min(count,Math.max(0,base.special+(p<0?p:wave>25?Math.ceil(p/2):0)));
  let formation=wave>=81||wave>=61&&p>=2?'elite':'mixed';
  if(formation==='elite'&&wave%10===5)formation='siege';
  const monsterEvery=p>=4?2:wave>200?3:wave>150?4:6;
  if(p>=0&&(wave>=100||wave>=80&&p>=2)&&wave%monsterEvery===0)formation='monster';
  const floor=wave<=40?7:wave<=80?4:wave<=150?2.5:1.5;
  return {count,special:formation==='mixed'?special:count,seconds:Math.round(Math.max(floor,Math.min(24,base.seconds*(1-p*.12)))*2)/2,formation};
 }
 adapt(){
  const b=this.battle,d=this.director;this.syncDefense();if(b.tick<d.nextTick)return;
  const before=this.wavePlan(this.wave+1),losses=Math.max(0,b.scores[1]-d.scores[1]),breaks=Math.max(0,b.scores[0]-d.scores[0]),totalKills=b.players.slice(0,2).reduce((n,p)=>n+p.kills,0),kills=Math.max(0,totalKills-d.kills);
  const danger=b.units.filter(u=>u.side===1&&!u.dead&&!u.exited&&!u.finishing&&!u.fleeing&&u.x< -700).length;
  if(losses>=4||this.defense<=15&&losses>0){d.pressure=Math.min(0,Math.max(-2,d.pressure-2));d.reliefUntil=b.tick+720;d.safeSamples=0;}
  else if(losses>=2||danger>=6){d.pressure=Math.max(-2,d.pressure-1);d.reliefUntil=b.tick+360;d.safeSamples=0;}
  else if(b.tick<d.reliefUntil){d.pressure=Math.min(0,d.pressure);d.safeSamples=0;}
  else if(losses===0&&danger<=1){
   d.safeSamples=kills>0||breaks>0?d.safeSamples+1:0;
   const dominant=breaks>=(this.solo?4:8)||kills>=(this.solo?4:8)&&d.safeSamples>=2;
   if(dominant)d.pressure=Math.min(6,d.pressure+1);else if(d.pressure<0)d.pressure++;
  }else d.safeSamples=0;
  d.scores=b.scores.slice();d.kills=totalKills;d.nextTick=b.tick+360;
  // Apply a pressure change to the remaining countdown, not just the next row.
  const after=this.wavePlan(this.wave+1);if(this.nextAt>b.tick&&before.seconds!==after.seconds)this.nextAt=b.tick+Math.max(24,Math.ceil((this.nextAt-b.tick)*after.seconds/before.seconds));
 }
 nextWaveAt(){return this.nextAt;}
 syncDefense(){
  const scores=this.battle?.scores||[0,0];
  this.defense??=50;this.defenseScores??=[0,0];
  // Apply each new breakthrough once. Full health cannot bank future healing.
  this.defense=Math.max(0,Math.min(50,this.defense+scores[0]-this.defenseScores[0]-(scores[1]-this.defenseScores[1])));
  this.defenseScores=scores.slice();return this.defense;
 }
 pick(allowed){
  if(allowed&&!POOL.some(u=>allowed.includes(u.type)))throw Error('empty endless troop tier');
  for(;;){if(this.cursor>=this.deck.length){this.deck=POOL.map((_,i)=>i);for(let i=this.deck.length-1;i>0;i--){const j=this.battle.int(i+1);[this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]];}this.cursor=0;}
   const u=POOL[this.deck[this.cursor++]];if(!allowed||allowed.includes(u.type))return u;
  }
 }
 step(){if(this.phase!=='battle')return;const b=this.battle;this.adapt();
  while(b.tick>=this.nextAt){const wave=this.wave+1,plan=this.wavePlan(wave);let {count,special}=plan;
   if(this.solo){count=Math.floor((this.halfCarry+count)/2);special=Math.min(count,Math.floor((this.specialCarry+special)/2));}
   const alive=b.units.filter(u=>u.side===1&&!u.dead&&!u.exited).length;
   // Defer a complete row at the unit cap; never award waves for empty spawns.
   if(alive+count>384){this.nextAt=b.tick+24;break;}
   if(this.solo){this.halfCarry=(this.halfCarry+plan.count)%2;this.specialCarry=(this.specialCarry+plan.special)%2;}
   const row=plan.formation==='monster'?this.pick(MONSTERS):plan.formation==='siege'?this.pick(SIEGE):plan.formation==='elite'?this.pick(ELITE):null;
   for(let lane=0;lane<count;lane++){const u=row||(lane<special?this.pick(wave<=25?MID:SPECIAL):POOL.find(u=>u.type===BASIC[(this.wave+lane)%BASIC.length]));b.spawn(2+ENEMY_RACES.indexOf(u.race),u.type,(lane+this.wave)%8);}
   this.wave++;this.nextAt+=Math.round(plan.seconds*24);
   if(this.wave%10===0||this.wave===15){const reward=this.wave===15?0:1000;this.armies.forEach(a=>a.gold=Math.min(10000000,a.gold+reward));this.rewardTotal+=reward;this.shopOffer={wave:this.wave,reward,votes:[false,false]};}
  }
  b.step();if(this.syncDefense()<=0)this.finish(false);
 }
 finish(){if(this.phase!=='battle')return;const b=this.battle;this.phase='failed';this.ready=[false,false];this.lastResult={stage:0,victory:false,reward:0,tick:b.tick,scores:b.scores.slice(),waves:this.wave,kills:b.players[0].kills+b.players[1].kills};}
 view(){const l=this.level(),b=this.battle;return {mode:this.mode,solo:this.solo,pressure:this.director.pressure,nextWavePlan:this.wavePlan(this.wave+1),shopOffer:this.shopOffer,intermission:this.intermission,rewardTotal:this.rewardTotal,phase:this.phase,stage:0,level:l.name,ready:this.ready,armies:this.armies,lastResult:this.lastResult,wave:this.wave,nextWaveAt:this.phase==='battle'?this.nextAt:null,progress:b?.scores[0]||0,progressMax:null,defense:this.defense,defenseMax:l.lives};}
 snapshot(){return structuredClone({...super.snapshot(),format:'warlords2-coop-endless',version:2,defense:this.defense,defenseScores:this.defenseScores,solo:this.solo,halfCarry:this.halfCarry,specialCarry:this.specialCarry,director:this.director,nextAt:this.nextAt,deck:this.deck,cursor:this.cursor,shopOffer:this.shopOffer,intermission:this.intermission,rewardTotal:this.rewardTotal});}
 static restore(input){const s=structuredClone(input);if(s?.format!=='warlords2-coop-endless'||s.version!==2||!Array.isArray(s.armies)||s.armies.length!==2||!s.armies.every(P.validateArmy)||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||!['shop','battle','failed'].includes(s.phase)||s.stage!==0||!Number.isSafeInteger(s.wave)||s.wave<0||!Number.isSafeInteger(s.nextAt)||s.nextAt<144||!Array.isArray(s.ready)||s.ready.length!==2||!s.ready.every(v=>typeof v==='boolean')||!Array.isArray(s.deck)||![0,POOL.length].includes(s.deck.length)||new Set(s.deck).size!==s.deck.length||s.deck.some(i=>!Number.isInteger(i)||i<0||i>=POOL.length)||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>s.deck.length)throw Error('invalid endless');
  if(s.shopOffer!=null&&(!Number.isInteger(s.shopOffer.wave)||(s.shopOffer.wave%10!==0&&s.shopOffer.wave!==15)||s.shopOffer.wave>s.wave||s.shopOffer.reward!==(s.shopOffer.wave===15?0:1000)||!Array.isArray(s.shopOffer.votes)||s.shopOffer.votes.length!==2||!s.shopOffer.votes.every(v=>typeof v==='boolean')))throw Error('invalid shop offer');
  if(!s.director||!Number.isInteger(s.director.pressure)||s.director.pressure< -2||s.director.pressure>6||!Number.isSafeInteger(s.director.nextTick)||s.director.nextTick<720||!Array.isArray(s.director.scores)||s.director.scores.length!==2||!s.director.scores.every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('invalid director');
  for(const [key,fallback,max]of [['kills',s.battle?.players?.slice(0,2).reduce((n,p)=>n+(p.kills||0),0)||0,Number.MAX_SAFE_INTEGER],['safeSamples',0,1000000],['reliefUntil',0,1000000000]]){s.director[key]??=fallback;if(!Number.isSafeInteger(s.director[key])||s.director[key]<0||s.director[key]>max)throw Error('invalid director history');}
  if(s.solo!==undefined&&typeof s.solo!=='boolean'||![0,1].includes(s.halfCarry??0)||![0,1].includes(s.specialCarry??0))throw Error('invalid solo');const c=new CoopEndless({races:s.armies.map(a=>a.race),seed:s.seed,solo:s.solo});c.halfCarry=s.halfCarry??0;c.specialCarry=s.specialCarry??0;for(const k of ['armies','phase','ready','wave','lastResult','nextAt','deck','cursor'])c[k]=s[k];c.director=s.director;c.shopOffer=s.shopOffer??null;c.intermission=s.intermission===true;c.rewardTotal=s.rewardTotal??0;c.battle=s.battle?Battle.restore(s.battle):null;
  if(s.defense===undefined&&s.defenseScores===undefined){c.defense=Math.max(0,50-(c.battle?.scores[1]||0));c.defenseScores=c.battle?.scores.slice()||[0,0];}
  else {if(!Number.isInteger(s.defense)||s.defense<0||s.defense>50||!Array.isArray(s.defenseScores)||s.defenseScores.length!==2||!s.defenseScores.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&v===(c.battle?.scores[i]||0)))throw Error('invalid endless defense');c.defense=s.defense;c.defenseScores=s.defenseScores;}
  if((['battle','failed'].includes(c.phase)||c.intermission)!==!!c.battle)throw Error('invalid endless battle');if(c.battle){const check=new CoopEndless({races:c.armies.map(a=>a.race),seed:c.seed});check.armies=structuredClone(c.armies);check.begin();if(c.battle.options.mode!=='coop'||!c.battle.options.mercenaries||JSON.stringify(c.battle.options.races)!==JSON.stringify(check.battle.options.races)||!c.intermission&&c.armies.some((a,i)=>JSON.stringify(a.roster)!==JSON.stringify(c.battle.options.rosters[i])||JSON.stringify(a.upgrades)!==JSON.stringify(c.battle.options.upgrades[i])))throw Error('invalid endless ownership');}return c;
 }
}
module.exports={CoopEndless,POOL,ENEMY_RACES,pacing,BASIC,MID,ELITE,MONSTERS,SIEGE};

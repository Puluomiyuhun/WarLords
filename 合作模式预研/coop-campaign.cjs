'use strict';
const {Battle}=require('../种族战役2复刻/engine.js');
const P=require('../种族战役2复刻/progression.js');
const C=require('../种族战役2复刻/content.js');
const LEVELS=require('./levels.json').levels;

class CoopCampaign {
 constructor({races=['human','elf'],seed=20260924}={}) {
  if(!Array.isArray(races)||races.length!==2||!races.every(r=>Object.hasOwn(C.races,r)))throw Error('races');
  this.seed=seed>>>0;this.armies=races.map(r=>P.createArmy(r));this.phase='shop';this.stage=0;
  this.ready=[false,false];this.wave=0;this.battle=null;this.lastResult=null;
 }
 command(owner,type,value) {
  if(!Number.isInteger(owner)||owner<0||owner>1)return false;
  if(this.phase==='shop') {
   if(type==='ready'&&typeof value==='boolean') {
    this.ready[owner]=value;if(this.ready.every(Boolean))this.begin();return true;
   }
   let ok=false;
   if(type==='buyUnit')ok=P.buyUnit(this.armies[owner],value);
   if(type==='buyUpgrade'&&value&&Number.isInteger(value.unit)&&Number.isInteger(value.upgrade))ok=P.buyUpgrade(this.armies[owner],value.unit,value.upgrade);
   if(type==='dismiss')ok=P.dismiss(this.armies[owner],value);
   if(ok)this.ready[owner]=false;return ok;
  }
  if(this.phase==='battle')return this.battle.command(owner,type,value,false);
  if(this.phase==='failed'&&type==='retry') {
   this.phase='shop';this.ready=[false,false];this.battle=null;this.wave=0;return true;
  }
  return false;
 }
 begin() {
  const level=LEVELS[this.stage];if(!level)throw Error('level');
  this.battle=new Battle({seed:(this.seed+this.stage*1009)>>>0,mode:'coop',
   races:[...this.armies.map(a=>a.race),level.enemyRace],
   rosters:[...this.armies.map(a=>a.roster),C.races[level.enemyRace].roster.slice(0,10)],
   upgrades:[...this.armies.map(a=>a.upgrades),level.upgrades],terrain:level.terrain});
  this.phase='battle';this.wave=0;this.ready=[false,false];
 }
 level(){return LEVELS[Math.min(this.stage,LEVELS.length-1)];}
 nextWaveAt() {
  const level=LEVELS[Math.min(this.stage,LEVELS.length-1)];
  return level.firstWaveAt+this.wave*level.waveInterval;
 }
 finish(victory) {
  const level=LEVELS[this.stage],b=this.battle;
  this.lastResult={stage:this.stage,victory,reward:victory?level.reward:0,tick:b.tick,scores:b.scores.slice(),waves:this.wave};
  this.ready=[false,false];
  if(!victory){this.phase='failed';return;}
  for(const army of this.armies)army.gold+=level.reward;
  this.stage++;this.phase=this.stage>=LEVELS.length?'complete':'shop';
 }
 step() {
  if(this.phase!=='battle')return;
  const level=LEVELS[this.stage],b=this.battle;
  // Repeat the authored sequence indefinitely; clearing one wave never wins a stage.
  while(b.tick>=this.nextWaveAt()) {
   const wave=level.waves[this.wave%level.waves.length];this.wave++;
   for(const lane of wave.lanes)b.spawn(2,wave.type,lane,undefined,!!wave.special);
  }
  b.step();
  // Defense failure wins ties if both thresholds are crossed in the same simulation tick.
  if(b.scores[1]>=level.lives)this.finish(false);
  else if(b.scores[0]>=level.target)this.finish(true);
 }
 view() {
  const level=LEVELS[Math.min(this.stage,LEVELS.length-1)];
  const scores=this.phase==='battle'?this.battle.scores:[0,0];
  return {phase:this.phase,stage:this.stage,level:level.name,ready:this.ready,armies:this.armies,
   lastResult:this.lastResult,wave:this.wave,nextWaveAt:this.phase==='battle'?this.nextWaveAt():null,
   progress:Math.min(level.target,scores[0]),progressMax:level.target,defense:Math.max(0,level.lives-scores[1]),defenseMax:level.lives};
 }
 snapshot() {
  return structuredClone({format:'warlords2-coop-research',version:2,seed:this.seed,armies:this.armies,
   phase:this.phase,stage:this.stage,ready:this.ready,wave:this.wave,lastResult:this.lastResult,battle:this.battle?.snapshot()??null});
 }
 static restore(input) {
  const s=structuredClone(input);
  if(!s||s.format!=='warlords2-coop-research'||s.version!==2||!Array.isArray(s.armies)||s.armies.length!==2||!s.armies.every(a=>P.validateArmy(a)&&!a.mercenaries)
   ||!['shop','battle','failed','complete'].includes(s.phase)||!Number.isInteger(s.stage)||s.stage<0||s.stage>LEVELS.length
   ||!Number.isInteger(s.wave)||s.wave<0||s.wave>100000||!Array.isArray(s.ready)||s.ready.length!==2||!s.ready.every(v=>typeof v==='boolean')
   ||!Number.isInteger(s.seed)||s.phase==='battle'&&(!s.battle||s.stage>=LEVELS.length))throw Error('invalid campaign');
  const c=new CoopCampaign({races:s.armies.map(a=>a.race),seed:s.seed});
  for(const k of ['armies','phase','stage','ready','wave','lastResult'])c[k]=s[k];
  c.battle=s.battle?Battle.restore(s.battle):null;
  if(c.battle&&(c.battle.options.mode!=='coop'||c.armies.some((a,i)=>a.race!==c.battle.options.races[i])))throw Error('invalid ownership');
  return c;
 }
}
module.exports={CoopCampaign,LEVELS};

'use strict';
const {CoopCampaign}=require('./coop-campaign.cjs');
const {Battle}=require('../种族战役2复刻/engine.js');
const C=require('../种族战役2复刻/content.js');
const P=require('../种族战役2复刻/progression.js');
const REGIONS=require('../种族战役2复刻/campaign-data.js');
// Combat specialties only: siege engines and unfinished caster abilities are not
// treated as defensive reinforcement troops. Each keeps its own race and owner.
const SPECIALS={human:[18,32],elf:[10,26],orc:[9,22],woodelf:[12,36],orc2:[11,20],undead:[17,34],human2:[13,31],troll:[16,35,37],demon:[14,33]};
const region=id=>REGIONS.find(r=>r.id===id);
class CoopConquest extends CoopCampaign {
 constructor(options={}){super(options);this.mode='conquest';this.owned=[17];this.target=this.targets()[0].id;}
 targets(){return REGIONS.filter(r=>!this.owned.includes(r.id)&&r.adjacent.some(id=>this.owned.includes(id))).sort((a,b)=>a.difficulty-b.difficulty||a.id-b.id);}
 level(){
  const r=region(this.target)||region(17),limit=Math.min(3,1+Math.floor(this.stage/3));
  const enemyRaces=[...new Set([r.race,...r.adjacent.map(id=>region(id).race)])].slice(0,limit);
  const base=C.races[r.race].baseRoster,interval=Math.max(144,216-this.stage*4);
  const row=(owner,type,special=false)=>({units:Array.from({length:8},(_,lane)=>({owner:!special||lane%2===0?owner:2,type:!special||lane%2===0?type:base[0],lane}))});
  const waves=[row(2,base[0]),row(2,base[1]),row(2,base[2])];
  // Reinforcements occupy alternating lanes; every wave is still exactly one row,
  // rather than one row per race. This avoids multiplying enemy output by three.
  for(let i=0;i<enemyRaces.length;i++)for(const type of SPECIALS[enemyRaces[i]])waves.push(row(i+2,type,true));
  return {name:r.name+(r.castle?' · 攻城':' · 野战'),region:r.id,enemyRace:r.race,enemyRaces,terrain:r.terrain,castle:r.castle,
   target:r.castle?7500:25,lives:50,reward:r.reward,firstWaveAt:144,waveInterval:interval,waves};
 }
 command(owner,type,value){
  if(!Number.isInteger(owner)||owner<0||owner>1)return false;
  if(type==='target'){
   if(this.phase!=='shop'||!Number.isInteger(value)||!this.targets().some(r=>r.id===value))return false;
   if(value!==this.target){this.target=value;this.ready=[false,false];}return true;
  }
  return super.command(owner,type,value);
 }
 begin(){
  if(this.phase!=='shop'||!this.targets().some(r=>r.id===this.target))throw Error('invalid target');
  const l=this.level(),enemyRosters=l.enemyRaces.map((race,i)=>[...new Set(l.waves.flatMap(w=>w.units.filter(u=>u.owner===i+2).map(u=>u.type)))]);
  this.battle=new Battle({seed:(this.seed+this.stage*1009+this.target*97)>>>0,mode:'coop',
   races:[...this.armies.map(a=>a.race),...l.enemyRaces],rosters:[...this.armies.map(a=>a.roster),...enemyRosters],
   upgrades:[...this.armies.map(a=>a.upgrades),...l.enemyRaces.map(()=>({}))],terrain:l.terrain,
   ...(l.castle?{siege:{side:1,target:7500}}:{})});
  this.phase='battle';this.wave=0;this.ready=[false,false];
 }
 nextWaveAt(){const l=this.level();return l.firstWaveAt+this.wave*l.waveInterval;}
 step(){
  if(this.phase!=='battle')return;
  const l=this.level(),b=this.battle;
  while(b.tick>=this.nextWaveAt()){const w=l.waves[this.wave++%l.waves.length];for(const u of w.units)b.spawn(u.owner,u.type,u.lane);}
  b.step();
  if(b.scores[1]>=l.lives)this.finish(false);
  else if((b.siege?b.siege.score:b.scores[0])>=l.target)this.finish(true);
 }
 finish(victory){
  if(this.phase!=='battle')return;
  const l=this.level(),b=this.battle;
  this.lastResult={stage:this.stage,region:this.target,victory,reward:victory?l.reward:0,tick:b.tick,scores:b.scores.slice(),waves:this.wave};
  this.ready=[false,false];if(!victory){this.phase='failed';return;}
  for(const a of this.armies)a.gold+=l.reward;
  this.owned.push(this.target);this.stage++;this.wave=0;this.battle=null;
  this.phase=this.owned.length===REGIONS.length?'complete':'shop';this.target=this.targets()[0]?.id??null;
 }
 view(){
  const l=this.level(),b=this.phase==='battle'?this.battle:null;
  return {mode:this.mode,phase:this.phase,stage:this.stage,level:l.name,ready:this.ready,armies:this.armies,lastResult:this.lastResult,wave:this.wave,
   nextWaveAt:b?this.nextWaveAt():null,progress:Math.min(l.target,b?(b.siege?b.siege.score:b.scores[0]):0),progressMax:l.target,
   defense:l.lives-(b?Math.min(l.lives,b.scores[1]):0),defenseMax:l.lives,
   map:{owned:this.owned,target:this.target,available:this.targets().map(r=>r.id),total:REGIONS.length}};
 }
 snapshot(){return structuredClone({...super.snapshot(),format:'warlords2-coop-conquest',version:1,owned:this.owned,target:this.target});}
 static restore(input){
  const s=structuredClone(input);
  if(s?.format!=='warlords2-coop-conquest'||s.version!==1||!Array.isArray(s.armies)||s.armies.length!==2||!s.armies.every(a=>P.validateArmy(a)&&!a.mercenaries)
   ||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||!Array.isArray(s.owned)||!s.owned.includes(17)||s.owned.some(id=>!region(id))||new Set(s.owned).size!==s.owned.length
   ||s.stage!==s.owned.length-1||!['shop','battle','failed','complete'].includes(s.phase)||!Array.isArray(s.ready)||s.ready.length!==2||!s.ready.every(v=>typeof v==='boolean')
   ||!Number.isInteger(s.wave)||s.wave<0||s.wave>100000)throw Error('invalid conquest');
  const connected=new Set([17]);let size;do{size=connected.size;for(const id of s.owned)if(region(id).adjacent.some(n=>connected.has(n)))connected.add(id);}while(size!==connected.size);
  if(connected.size!==s.owned.length)throw Error('disconnected conquest');
  const c=new CoopConquest({races:s.armies.map(a=>a.race),seed:s.seed});
  for(const k of ['armies','phase','stage','ready','wave','lastResult','owned','target'])c[k]=s[k];
  if((c.phase==='complete')!==(c.owned.length===REGIONS.length)||c.phase==='complete'&&c.target!==null||c.phase!=='complete'&&!c.targets().some(r=>r.id===c.target))throw Error('invalid conquest target');
  c.battle=s.battle?Battle.restore(s.battle):null;
  if(['battle','failed'].includes(c.phase)!==!!c.battle)throw Error('invalid conquest battle');
  if(c.battle){const expected=new CoopConquest({races:c.armies.map(a=>a.race),seed:c.seed});for(const k of ['armies','owned','stage','target'])expected[k]=structuredClone(c[k]);expected.begin();
   if(JSON.stringify(c.battle.options)!==JSON.stringify(expected.battle.options))throw Error('invalid conquest ownership');}
  return c;
 }
}
module.exports={CoopConquest,REGIONS,SPECIALS};

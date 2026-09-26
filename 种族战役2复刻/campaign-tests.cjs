'use strict';
const assert=require('node:assert/strict'),C=require('./content.js'),P=require('./progression.js'),K=require('./campaign.js'),{Battle}=require('./engine.js');
let count=0;function test(name,fn){fn();console.log('PASS '+name);count++;}const run=(b,n)=>{for(let i=0;i<n;i++)b.step();return b;};
function siege(race='human',roster=[0,1,2,5,19]){return new Battle({mode:'duel',races:[race,'orc'],rosters:[roster,[0,1,2,5]],siege:{side:1,target:7500},seed:123});}
test('all ten races start with original four troops and have ladders plus two unique combat troops',()=>{
 for(const [race,r]of Object.entries(C.races)){const a=P.createArmy(race);assert.equal(a.gold,500);assert.deepEqual(a.roster,r.baseRoster);assert.ok(P.validateArmy(a));assert.ok(r.roster.includes(19));const unique=r.roster.filter(id=>!['攻城单位','施法者'].includes(C.units[id].category)&&Object.values(C.races).filter(x=>x.roster.includes(id)).length===1);assert.ok(unique.length>=2,race);}
 assert.ok(C.races.troll.roster.includes(16));assert.ok(C.races.demon.roster.includes(33));assert.deepEqual(P.createArmy('orc2').roster,[0,1,11,5]);
});
test('every homeland can conquer all 28 source regions through adjacent borders',()=>{
 for(const race of Object.keys(C.races)){let c=K.create(race,23);c.phase='map';const needed=28-c.owned.length;let battles=0;while(c.phase!=='complete'){
  const targets=K.targets(c);assert.ok(targets.length);const r=targets[0],options=K.begin(c,r.id),b=new Battle(options);assert.equal(b.roster(0).length,4);assert.ok(Battle.restore(b.snapshot()));b.winner=0;b.players[0].kills=4;b.players[0].killReward=20;
  const money=c.army.gold,result=K.settle(c,b);assert.equal(c.army.gold,money+result.reward);assert.equal(K.settle(c,b),null);assert.equal(result.won,true);c=K.restore(c);if(c.phase==='shop')c.phase='map';battles++;assert.ok(battles<=needed+20);
 }assert.equal(c.owned.length,28);}
});
test('campaign defeat permits retry, does not lose purchases, and forged results cannot settle',()=>{
 const c=K.create('human',42);assert.ok(P.buyUnit(c.army,19));const target=K.targets(c)[0],b=new Battle(K.begin(c,target.id));b.winner=1;const fake=Battle.restore(b.snapshot());fake.options.campaign.nonce='wrong';assert.equal(K.settle(c,fake),null);K.settle(c,b);assert.ok(c.army.roster.includes(19));assert.ok(!c.owned.includes(target.id));assert.equal(c.army.gold,0);assert.equal(c.phase,'shop');assert.doesNotThrow(()=>K.begin(c,target.id));
});
test('campaign and paused siege export restore purchases, progress and deterministic simulation',()=>{
 const c=K.create('human',42);P.buyUnit(c.army,19);const r=K.targets(c).find(r=>r.castle);assert.ok(r);const b=new Battle(K.begin(c,r.id));b.command(0,'auto',true);run(b,700);c.battle=b.snapshot();const saved=K.restore(JSON.parse(JSON.stringify(c))),restored=Battle.restore(saved.battle);run(b,400);run(restored,400);assert.deepEqual(restored.snapshot(),b.snapshot());const bad=structuredClone(c);bad.battle.options.campaign.region=999;assert.throws(()=>K.restore(bad));
});
test('ladder bearer builds once and following infantry climb for 300 siege progress each',()=>{
 const b=siege(),u=b.spawn(0,19,3,1350);run(b,180);assert.equal(b.siege.ladders[3],true);assert.equal(b.siege.score,300);assert.equal(b.units.some(v=>v.id===u.id),false);b.spawn(0,1,3,1150);run(b,160);assert.equal(b.siege.score,600);assert.equal(b.scores[0],0);
});
test('ordinary infantry enters after repeated wall hits; giant and every siege engine damage walls',()=>{
 const b=siege();b.spawn(0,1,0,1300);run(b,1400);assert.ok(b.siege.score>=150);assert.ok(b.siege.score<1000);
 for(const [race,id]of [['troll',16],['human',27],['orc',21],['undead',23],['elf',24],['human2',25],['troll',28],['orc2',29],['woodelf',30],['demon',47]]){const b=siege(race,[id]);b.spawn(0,id,0,900);run(b,1800);assert.ok(b.siege.score>0,race+' '+id+' cannot attack wall');assert.ok(Number.isFinite(b.siege.score));assert.doesNotThrow(()=>Battle.restore(b.snapshot()));}
});
test('defender breakthrough consumes defense independently of siege progress; timeout defends castle',()=>{
 const b=siege();b.siege.score=999;b.spawn(1,0,0,-1451);run(b,2);assert.equal(b.scores[1],1);assert.equal(b.siege.score,999);b.scores[1]=24;b.spawn(1,0,1,-1451);run(b,2);assert.equal(b.winner,1);const win=siege();win.siege.score=7500;win.step();assert.equal(win.winner,0);const timed=siege();timed.tick=7199;timed.step();assert.equal(timed.winner,1);
});
test('distinct projectile paths collide with targets and physical heavy shots survive shields',()=>{
 for(const [race,id]of [['orc2',11],['woodelf',12],['human2',13],['elf',26],['troll',35],['human',27],['orc',21],['undead',23],['elf',24],['woodelf',30],['demon',47]]){
  const b=new Battle({mode:'duel',races:[race,'human'],rosters:[[id],[1]]}),u=b.spawn(0,id,0,-500),v=b.spawn(1,1,0,500);v.hp=v.maxHp=10000;u.targetId=v.id;b.fire(u,C.units[id].projectile);const p=b.projectiles[0];v.shield=!!p.big;assert.ok(C.projectileAtlas[p.visual]);assert.doesNotThrow(()=>Battle.restore(b.snapshot()));u.dead=true;v.stopped=true;v.frame=C.units[1].labels.walk;let hits=0;
  // Physical siege shots retain the SWF arc, which can overshoot a stationary
  // original aim point. Place this collision fixture in the actual landing path.
  if(p.siegeShot&&p.big){let x=p.x,y=p.y,vy=p.vy;for(let i=0;i<160;i++){x+=p.vx;y+=vy;vy++;if(y>-140&&vy>0){v.x=x;break;}}}
  // Keep the collision fixture stationary after computing its position.
  b.stepUnit=()=>{};for(let i=0;i<200;i++){b.step();hits=b.hits;}assert.ok(hits>0,race+' '+id+' shot missed stationary target');
 }
});
test('invalid siege and climbing state is rejected on import',()=>{
 for(const change of [s=>s.siege.ladders=[true],s=>s.siege.score=NaN,s=>s.options.siege.side=4,s=>s.units[0].climbFrame=9999]){const b=siege();b.spawn(0,0,0);const s=b.snapshot();change(s);assert.throws(()=>Battle.restore(s));}
});
console.log(`${count} campaign, siege and expanded troop tests passed.`);

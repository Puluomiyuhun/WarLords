'use strict';
const assert=require('node:assert/strict'),{Battle}=require('./engine.js'),C=require('./content.js'),{packet}=require('../联机预研/room-server.cjs');
const artillery=[['human',27,127,1,207],['elf',24,112,1,175],['orc',21,119,1,396],['woodelf',30,107,1,188],['undead',23,119,5,396],['troll',28,119,1,396],['demon',47,97,1,120],['persian',27,127,1,207]];
function setup(race,type,side=0,distance=900,options={}){const races=side?['human',race]:[race,'human'],rosters=side?[[1],[type]]:[[type],[1]],b=new Battle({mode:'duel',races,rosters,seed:314,...options}),u=b.spawn(side,type,3,0),v=b.spawn(1-side,1,3,(side?-1:1)*distance);v.hp=v.maxHp=10000;u.targetId=v.id;return {b,u,v};}
for(const [race,type,release,count,end]of artillery)for(const side of [0,1]){
 const {b,u,v}=setup(race,type,side);u.frame=C.units[type].labels.swipe1;
 while(u.frame<release)b.stepUnit(u);assert.equal(b.projectiles.length,0);
 b.stepUnit(u);assert.equal(b.projectiles.length,count,race+' release frame '+release);
 while(u.frame<end)b.stepUnit(u);assert.equal(b.projectiles.length,count,'one authored volley per attack timeline');
 assert.equal(C.units[type].health,140);assert.equal(C.units[type].charge,180);
 const p=b.projectiles[0];assert.equal(p.dir,u.dir);
 if(['rock','skull','log'].includes(p.visual))assert.equal(Math.sign(p.vx),u.dir);
 if(p.visual==='rock'){const speed=type===27?35:43,angle=Math.asin((v.x-u.x)/speed**2)/2;assert(Math.abs(p.vx-speed*Math.sin(angle))<1e-10);assert.equal(p.y,type===27?-576:-266);}
 if(type===23){assert.equal(new Set(b.projectiles.map(p=>p.x+':'+p.y+':'+p.vx)).size,5);assert(b.projectiles.every(p=>p.damage===50));}
}
console.log('PASS all faction launch frames, volley counts, attack duration and original stats');
for(const type of [25,29])for(const side of [0,1]){
 const {b,u,v}=setup(type===25?'human2':'orc2',type,side,40);u.speed=20;u.frame=9;v.hp=10000;b.random=()=>.5;
 let impacts=0;const impact=b.impact.bind(b);b.impact=(...args)=>{impacts++;return impact(...args)};
 for(let frame=9;frame<=28;frame++)b.stepUnit(u);
 assert.equal(impacts,1,'ram strikes only at frame 22');assert(v.hp<10000);assert(u.speed<5,'momentum resets after contact');
 const siege=setup(type===25?'human2':'orc2',type,side,200,{siege:{side:1-side,target:7500}});siege.b.random=()=>.5;siege.u.x=siege.u.dir*1380;siege.u.speed=20;siege.u.frame=22;siege.u.targetId=-4;siege.b.stepUnit(siege.u);assert(siege.b.siege.score>0);assert(siege.u.speed<0,'ram rebounds off castle');
}
assert.equal(setup('human2',25,0,100,{upgrades:[{25:[37]},{}]}).u.speed,10);
console.log('PASS both ram factions: one impact per cycle, contact reset, castle rebound and upgrade speed');
for(const shield of [false,true]){
 const {b,u,v}=setup('demon',47,0,400);v.shield=shield;b.random=()=>.5;b.fire(u,'fire');const p=b.projectiles[0];
 for(let i=0;i<15&&p.phase!=='impact';i++){b.stepSiegeProjectile(p);assert(p.phase==='impact'||p.frame<=2,'flight must not play explosion');}
 assert.equal(p.phase,'impact');assert.equal(p.frame,3);assert.equal(v.hp,shield?10000:9900);
 for(let i=0;i<15;i++)b.stepSiegeProjectile(p);assert(p.done);assert.equal(v.hp,shield?10000:9900);
}
console.log('PASS tower fire: horizontal flight, shield block, one hit and finite explosion');
for(const side of [0,1]){
 const {b,u,v}=setup('elf',24,side,900);b.random=()=>.5;b.fire(u,'obelisk');const p=b.projectiles[0];let lowest=0;
 for(let i=0;i<180&&p.phase!=='impact';i++){v.x+=v.dir*2;b.stepSiegeProjectile(p);lowest=Math.min(lowest,p.y);if(p.phase==='fall')assert.equal(p.frame,1);}
 assert(lowest<-2000);assert.equal(p.phase,'impact');assert.equal(p.x,v.x);assert.equal(v.hp,9890);assert.equal(p.frame,2);
 for(let i=0;i<12;i++)b.stepSiegeProjectile(p);assert(p.done);assert.equal(v.hp,9890);
}
console.log('PASS obelisk: vertical ascent, tracking descent, one impact and both directions');
for(const [race,type,visual,damage]of [['orc',21,'rock',200],['human',27,'rock',150],['woodelf',30,'log',100],['undead',23,'skull',50]]){
 const {b,u,v}=setup(race,type,0,100);b.random=()=>.5;b.fire(u,visual);const p=b.projectiles[0];p.x=100;p.y=-90;p.vx=p.vy=0;p.rotation=0;v.shield=true;b.stepSiegeProjectile(p);assert.equal(v.hp,10000-damage/2);assert(p.hit);assert(!p.done);b.stepSiegeProjectile(p);assert.equal(v.hp,10000-damage/2);
 p.y=-30;p.vx=20;const rot=p.rotation;b.stepSiegeProjectile(p);assert(p.vx<20);assert(p.rotation!==rot);assert(p.alpha<1);for(let i=0;i<100;i++)b.stepSiegeProjectile(p);assert(p.done);
}
console.log('PASS physical ammunition: shield penetration, single damage, ground roll and fade');
const upgraded=setup('orc',21,0,900,{upgrades:[{21:[32,7]},{}]});upgraded.b.fire(upgraded.u,'rock');assert.equal(upgraded.b.projectiles[0].damage,300,'original rock upgrade applies once; no generic projectile damage boost');
for(const [race,type]of artillery){const {b,u}=setup(race,type);b.fire(u,C.units[type].projectile);for(let i=0;i<15;i++)b.step();const restored=Battle.restore(b.snapshot());for(let i=0;i<160;i++){b.step();restored.step();}assert.deepEqual(b.snapshot(),restored.snapshot());}
const {b,u}=setup('woodelf',30);b.fire(u,'log');b.stepSiegeProjectile(b.projectiles[0]);const shot=b.projectiles[0],wire=packet({battle:b,seats:[]}).arrows[0];assert.equal(wire[11],shot.rotation);assert.equal(wire[12],shot.alpha);
const bad=b.snapshot();bad.projectiles[0].rotation=NaN;assert.throws(()=>Battle.restore(bad));
console.log('PASS upgrades, deterministic saves, invalid data rejection and network visual state');

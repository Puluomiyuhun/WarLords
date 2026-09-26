'use strict';
const assert=require('node:assert/strict');
const {Battle}=require('./engine.js'),C=require('./content.js'),P=require('./progression.js');
const setup=()=>new Battle({mode:'coop',races:['human','elf','human'],rosters:[[0,1,2,5,100],[0,1,2,5],[0,1,2,5,100]],seed:56});
function damage(b,v,a){v.hp=v.maxHp=1000;b.hurt(v,100,a);return 1000-v.hp;}
const b=setup(),a=b.spawn(1,0,3,-300),enemy=b.spawn(2,0,3,300),flag=b.spawn(0,100,3,-500);
assert.equal(damage(b,enemy,a),120,'co-op teammate receives attack bonus');
assert.equal(damage(b,a,enemy),85,'damage reduction is applied without changing max health');
const second=b.spawn(0,100,3,-600);assert.equal(damage(b,enemy,a),120,'standards do not stack');
assert.equal(damage(b,enemy,{...a,lane:2}),100,'attacks from another lane receive no bonus');
const other=b.spawn(1,0,2,-300);assert.equal(damage(b,other,enemy),100,'another lane is not protected');
flag.dead=true;second.exited=true;assert.equal(damage(b,enemy,a),100,'last standard leaving removes attack bonus');
assert.equal(damage(b,a,enemy),100,'last standard leaving removes defense bonus');
flag.dead=false;flag.climbFrame=1;assert.equal(b.laneSupported(0,3),false,'climbing standard leaves the lane');delete flag.climbFrame;
const enemyFlag=b.spawn(2,100,3,500);assert.equal(damage(b,enemy,a),102,'opposing flags apply independently');
// Real projectile hit must carry its lane into the damage pipeline.
enemyFlag.dead=true;b.random=()=>.5;enemy.hp=1000;
b.projectiles.push({id:b.nextId++,owner:1,side:0,lane:3,x:enemy.x-2,y:-66,vx:3,vy:0,targetId:enemy.id,firerType:2,age:0,damage:100});
b.stepUnit=()=>{};b.step();assert.equal(enemy.hp,940,'arrow damage receives 20% bonus on impact');
const m=setup();m.spawn(0,100,3,-600);m.spawn(1,0,3,-300);m.spawn(2,1,3,100);
for(let i=0;i<30;i++)m.step();const resumed=Battle.restore(m.snapshot());
for(let i=0;i<300;i++){m.step();resumed.step();}assert.deepEqual(m.snapshot(),resumed.snapshot(),'buff remains deterministic across save/restore');
const human=P.createArmy('human',2000),elf=P.createArmy('elf',2000);
assert.equal(P.buyUnit(human,100),true);assert.equal(human.gold,800);assert.equal(P.buyUnit(elf,100),false);
assert.equal(P.eligible('human',100,0),false,'no spear special upgrade leaks into banner');
assert.deepEqual(C.atlas['human-100'],C.atlas['human-0'],'original human animation pixels and geometry are reused');
console.log('PASS banner: allied lane damage/defense, no stacking, removal, opposing flags, arrows, save/replay, faction shop and original human art');

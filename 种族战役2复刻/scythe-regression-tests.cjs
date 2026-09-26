'use strict';
const assert=require('node:assert/strict'),{Battle}=require('./engine.js');
for(const side of [0,1])for(const distance of [40,69,70,200]){
 const b=new Battle({mode:'duel',races:['undead','undead'],rosters:[[0,34],[0,34]],seed:12}),u=b.spawn(side,34,3,0),v=b.spawn(1-side,0,3,(side===0?1:-1)*distance);
 u.targetId=v.id;u.frame=92;u.speed=5;v.hp=v.maxHp=10000;
 b.stepUnit(u);
 if(distance<70){assert.equal(u.frame,112);assert.equal(u.x,0);b.stepUnit(u);assert.ok(u.x*u.dir<0,'close enemy triggers authored backward attack');}
 else {assert.equal(u.frame,93);assert.ok(u.x*u.dir>0,'normal attack advances at and beyond 70');for(let i=0;i<11;i++)b.stepUnit(u);assert.ok(v.hp<10000,'forward attack reaches its damage frame');}
}
const b=new Battle({mode:'duel',races:['undead','undead'],rosters:[[0,34],[0,34]],seed:55}),u=b.spawn(0,34,3,0);b.spawn(1,0,3,200);for(let i=0;i<70;i++)b.step();const restored=Battle.restore(b.snapshot());for(let i=0;i<150;i++){b.step();restored.step();}assert.deepEqual(b.snapshot(),restored.snapshot());
console.log('PASS scythe: both directions, 70-unit threshold, forward damage and deterministic restore');

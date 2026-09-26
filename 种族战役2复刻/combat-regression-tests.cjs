const assert=require('node:assert/strict'),{Battle}=require('./engine.js');
function battle(){return new Battle({mode:'duel',races:['human','human'],rosters:[[0,1,3,4,6,38],[0,1,3,4,6,38]],upgrades:[{1:[1]},{}],seed:724});}
for(const side of [0,1]){
 const west=new Battle({mode:'duel',races:['human2','human2']}),guard=west.spawn(side,31,3,0);
 for(let i=0;i<120;i++)west.stepUnit(guard);
 assert.ok(guard.x*guard.dir>100,'Western human shield bearer advances from spawn');assert.equal(guard.shield,true);
 const b=battle(),u=b.spawn(side,1,3,0,true);u.specialLevel=2;
 for(let i=0;i<120;i++)b.stepUnit(u);
 assert.ok(u.x*u.dir>100,'raised shield advances in both directions');assert.equal(u.shield,true);
 for(const type of [4,6]){
  const c=battle(),horse=c.spawn(side,type,3,0),front=c.spawn(1-side,1,3,horse.dir*40),rear=c.spawn(1-side,1,3,horse.dir*80);
  assert.equal(horse.speed,0,'original cavalry starts at zero');horse.speed=30;
  const hp=front.hp;c.move(horse,{move:true});
  assert.equal(front.knockFrame,1,'speed 30 knocks down nearest enemy');assert.equal(rear.knockFrame,undefined);
  assert.equal(front.hp,hp,'original random(1) collision has no damage');assert.equal(horse.speed,1/1.099971389770508);
  const slow=battle(),h=slow.spawn(side,type,3,0),v=slow.spawn(1-side,1,3,h.dir*40);h.speed=29;
  const vx=v.x;slow.move(h,{move:true});assert.equal(v.knockFrame,undefined);
  assert.equal((v.x-vx)*h.dir,29,'contact pushes using pre-deceleration speed');assert.equal(h.speed,29/1.099971389770508);
  for(let i=0;i<40;i++)slow.move(h,{move:true});assert.ok(h.speed<1,'repeated contact gradually slows movement');
  v.dead=true;h.frame=require('./content.js').units[type].labels.walk;const old=h.speed;slow.stepUnit(h);assert.equal(h.speed,old+1,'walk frame accelerates again');
 }
 for(const type of [3,38]){
  const c=battle(),mage=c.spawn(side,type,3,0),foe=c.spawn(1-side,1,3,mage.dir*600);let emitted=false;
  for(let i=0;i<160;i++){c.stepUnit(mage);for(const p of c.projectiles){emitted ||= p.kind==='bolt';if(!p.done)c.stepMagic(p);}}
  assert.ok(emitted,'unupgraded mage emits bolt through normal decisions');assert.ok(foe.hp<foe.maxHp,'bolt damages target');
 }
}
const b=battle();b.spawn(0,38,2,-400);b.spawn(1,1,2,400);b.spawn(0,4,3,-100);b.spawn(1,1,3,50);
for(let i=0;i<40;i++)b.step();const restored=Battle.restore(b.snapshot());for(let i=0;i<200;i++){b.step();restored.step();}assert.deepEqual(b.snapshot(),restored.snapshot());
console.log('PASS combat regressions: shield movement, cavalry blocking/recovery, default mage bolts in both directions, deterministic restoration');

const assert=require('node:assert/strict');
const {Battle}=require('./engine.js');
const C=require('./content.js');
let passed=0;
function test(name,fn){fn();console.log('PASS '+name);passed++;}
function run(b,n){for(let i=0;i<n;i++)b.step();return b;}
test('shared charge respects original 50/87/115/70 tick thresholds',()=>{
 const b=new Battle({mode:'duel'});run(b,49);assert.equal(b.command(0,'send'),false);b.step();assert.equal(b.command(0,'send'),true);assert.equal(b.players[0].charge,0);b.command(0,'select',1);run(b,86);assert.equal(b.command(0,'send'),false);b.step();assert.equal(b.command(0,'send'),true);
});
test('melee only hits at authored animation event and respects lane/range',()=>{
 const b=new Battle({mode:'duel',seed:99}),a=b.spawn(0,0,3,0),v=b.spawn(1,1,3,180);b.random=()=>0.5;a.targetId=v.id;a.frame=64;b.stepUnit(a);assert.equal(v.hp,100);b.stepUnit(a);assert.equal(v.hp,95);const hp=v.hp;a.frame=65;v.x=1000;b.stepUnit(a);assert.equal(v.hp,hp);v.x=100;v.lane=4;assert.equal(b.target(a),null);
});
test('archer minimum range, ammo and ballistic projectile',()=>{
 const b=new Battle({mode:'duel'}),a=b.spawn(0,2,0,-1200),v=b.spawn(1,0,0,1000);assert.equal(b.target(a),v);v.x=-100;assert.equal(b.target(a),null);v.x=1000;a.targetId=v.id;a.frame=118;b.stepUnit(a);assert.equal(a.ammo,9);assert.equal(b.projectiles.length,1);assert.ok(b.projectiles[0].vy<0);a.ammo=0;b.fire(a);assert.equal(b.projectiles.length,1);
});
test('breakthrough increments once and lead of 25 wins',()=>{
 const b=new Battle({mode:'duel'});b.scores=[24,0];const a=b.spawn(0,0,0,1449);a.frame=C.units[0].labels.walk;b.step();assert.equal(b.scores[0],25);assert.equal(b.winner,0);assert.ok(!b.units.includes(a));
});
test('timeout resolves lead, ties continue',()=>{
 const a=new Battle({mode:'duel'});a.tick=7199;a.scores=[4,3];a.step();assert.equal(a.winner,0);const b=new Battle({mode:'duel'});b.tick=7199;b.step();assert.equal(b.winner,null);
});
test('fixed seed gives identical full AI battle',()=>{
 const a=run(new Battle({mode:'watch',seed:1001}),7400),b=run(new Battle({mode:'watch',seed:1001}),7400);assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(a.players[0].spawned>30);assert.ok(a.hits>100);assert.notEqual(a.winner,null);console.log('  battle:',a.tick,'ticks; score',a.scores,'hits',a.hits,'spawns',a.players.map(p=>p.spawned));
});
test('save/restore including flying arrows continues identically',()=>{
 const a=run(new Battle({mode:'watch',seed:876}),2200);const archer=a.spawn(0,2,0,-1300),target=a.spawn(1,0,0,1100);archer.targetId=target.id;a.fire(archer);assert.ok(a.projectiles.length>0);const b=Battle.restore(JSON.parse(JSON.stringify(a.snapshot())));run(a,1800);run(b,1800);assert.deepEqual(a.snapshot(),b.snapshot());
});
test('recorded player commands replay deterministically',()=>{
 const a=new Battle({mode:'duel',seed:51});for(let i=0;i<1200;i++){if(i%80===0){a.command(0,'lane',(i/80)%8);a.command(0,'select',[0,1,2,5][(i/80)%4]);a.command(0,'send');}if(i%100===0){a.command(1,'lane',(i/100)%8);a.command(1,'send');}a.step();}
 const b=new Battle({mode:'duel',seed:51});for(let i=0;i<1200;i++){for(const c of a.commands.filter(c=>c.tick===i))b.command(c.side,c.type,c.value);b.step();}assert.deepEqual(a.snapshot(),b.snapshot());
});
test('invalid save is rejected and dead units stop dealing damage',()=>{
 assert.throws(()=>Battle.restore({version:99}));const b=new Battle({mode:'duel'});const a=b.spawn(0,0,1,0),v=b.spawn(1,0,1,100);b.hurt(a,100,v);const hp=v.hp;run(b,200);assert.equal(v.hp,hp);assert.ok(a.stopped);
});
test('malformed imported unit skin is rejected before rendering',()=>{const b=new Battle({mode:'duel'});b.spawn(0,0,0);const s=b.snapshot();s.units[0].race='missing';assert.throws(()=>Battle.restore(s));});
console.log(`${passed} tests passed.`);

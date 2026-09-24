const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Battle}=require('./engine.js'),C=require('./content.js');let count=0;
function test(name,f){f();console.log('PASS '+name);count++;}
function run(b,n){for(let i=0;i<n;i++)b.step();return b;}
test('all nine race rosters have playable authored frames, desktop/mobile textures and icons',()=>{
 assert.equal(Object.keys(C.races).length,9);assert.equal(Object.keys(C.units).length,48);
 for(const [race,r]of Object.entries(C.races))for(const id of r.roster){
  const d=C.units[id],m=C.atlas[race+'-'+id];assert.ok(m);assert.equal(m.frameRects.length,m.frames);
  for(let n=1;n<=d.swipes;n++)assert.ok(d.labels['swipe'+n],race+' '+id+' swipe'+n);
  for(const p of m.pages){assert.ok(p.width<=2048&&p.height<=2048);assert.ok(fs.existsSync(path.join(__dirname,'assets',p.file)));assert.ok(fs.existsSync(path.join(__dirname,'assets/mobile',p.file)));}
  for(const rect of m.frameRects){const page=m.pages[rect.page];assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=page.width&&rect.y+rect.h<=page.height);}
  assert.ok(fs.existsSync(path.join(__dirname,`assets/icon-${race}-${id}.png`)));
 }
});
test('race-exclusive units and variable-length rosters are enforced',()=>{
 const b=new Battle({mode:'duel',races:['human','woodelf']});assert.ok(b.command(0,'select',32));assert.equal(b.command(1,'select',32),false);assert.ok(b.command(1,'select',36));assert.equal(b.command(0,'select',36),false);
});
test('every migrated melee unit reaches an authored damage event in combat',()=>{
 for(const [race,r]of Object.entries(C.races))for(const id of r.roster.filter(id=>!C.units[id].ranged)){
  const b=new Battle({mode:'duel',races:[race,race],seed:100+id}),a=b.spawn(0,id,3,-80),v=b.spawn(1,0,3,80);a.hp=a.maxHp=v.hp=v.maxHp=100000;
  run(b,500);assert.ok(v.hp<100000,`${race} ${C.units[id].name} dealt no damage`);assert.ok(Number.isFinite(a.x));
 }
});
test('samurai repeated frame calls move twice the base speed during lunge',()=>{
 const b=new Battle({mode:'duel',races:['orc2','human']}),u=b.spawn(0,20,0,0);u.speed=6;u.frame=81;b.stepUnit(u);assert.equal(u.x,12);b.stepUnit(u);assert.equal(u.x,24);
});
test('shield guards during walk, opens during attack, and jumps back to ready',()=>{
 const b=new Battle({mode:'duel',races:['human2','human']}),u=b.spawn(0,31,0,0),enemy=b.spawn(1,0,0,100);b.random=()=>.1;u.frame=17;b.stepUnit(u);assert.equal(u.shield,true);enemy.targetId=u.id;const hp=u.hp;b.attack(enemy,{range:500,power:100});assert.equal(u.hp,hp);
 u.frame=38;b.stepUnit(u);assert.equal(u.shield,false);b.attack(enemy,{range:500,power:100});assert.ok(u.hp<hp);u.frame=66;b.stepUnit(u);assert.equal(u.frame,17);
});
test('impact uses half-power damage, knockdown displacement and authored recovery loop',()=>{
 const b=new Battle({mode:'duel'}),a=b.spawn(0,32,0,0),v=b.spawn(1,1,0,100);a.targetId=v.id;v.hp=v.maxHp=1000;b.random=()=>.5;
 b.impact(a,{range:110,power:180});assert.equal(v.hp,955);assert.equal(v.knockFrame,1);assert.equal(b.target(a),null);b.stepUnit(v);assert.equal(v.x,150);assert.equal(v.knockFrame,2);
 v.knockFrame=38;b.stepUnit(v);assert.equal(v.knockFrame,35);b.random=()=>.95;for(let i=0;i<20;i++)b.stepUnit(v);assert.equal(v.knockFrame,0);
});
test('knockdown, projectile and expanded race save roundtrip stays deterministic',()=>{
 const a=new Battle({mode:'watch',races:['human','undead'],seed:789});run(a,1000);const hammer=a.spawn(0,32,1,0),target=a.spawn(1,1,1,90);target.hp=1000;hammer.targetId=target.id;a.impact(hammer,{range:200,power:200});assert.ok(target.knockFrame);
 const b=Battle.restore(a.snapshot());run(a,1600);run(b,1600);assert.deepEqual(a.snapshot(),b.snapshot());
});
test('v1 save migrates retaining its four-unit roster; unsupported race/unit combinations are rejected',()=>{
 const b=new Battle({mode:'duel',rosters:[[0,1,2,5],[0,1,2,5]]});b.spawn(0,0,1);let s=b.snapshot();s.version=1;delete s.options.rosters;const migrated=Battle.restore(s);assert.deepEqual(migrated.roster(0),[0,1,2,5]);assert.equal(migrated.snapshot().version,4);
 s=migrated.snapshot();s.units[0].type=36;assert.throws(()=>Battle.restore(s));
});
test('all race AI matches run to a result with finite state and legal troop selection',()=>{
 const races=Object.keys(C.races);
 for(let i=0;i<races.length;i++){
  const b=run(new Battle({mode:'watch',races:[races[i],races[(i+1)%races.length]],seed:900+i}),15000);
  assert.notEqual(b.winner,null,races[i]+' did not end');assert.ok(b.hits>0);for(const u of b.units)assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.hp)&&u.frame>=1);
  console.log('  match',races[i],b.options.races[1],b.tick,b.scores,b.hits);
 }
});
console.log(`${count} expansion tests passed.`);

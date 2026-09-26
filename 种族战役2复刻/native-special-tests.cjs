'use strict';
const assert=require('node:assert/strict'),{Battle}=require('./engine.js'),C=require('./content.js'),P=require('./progression.js');
const {POOL}=require('../合作模式预研/coop-endless.cjs'),{packet}=require('../联机预研/room-server.cjs');
const make=()=>new Battle({mode:'coop',races:['human2','woodelf','human'],rosters:[[0,1,2,5,105],[0,1,2,5,106],[0,1,2,5,4]],seed:20260926});
const b=make(),medic=b.spawn(0,105,3,0),ally=b.spawn(1,1,3,100),other=b.spawn(0,105,3,10),enemy=b.spawn(2,1,3,120),adjacent=b.spawn(1,1,2,20);
ally.hp=50;other.hp=1;enemy.hp=1;adjacent.hp=1;
b.decide(medic);assert.equal(medic.targetId,ally.id);assert.equal(medic.frame,C.units[105].labels.swipe1);assert.equal(medic.healReadyAt,168);
medic.frame=128;b.stepUnit(medic);assert.equal(ally.hp,50,'healing waits for orb arrival');assert.equal(b.projectiles[0].kind,'heal');for(let i=0;i<12;i++)b.stepHeal(b.projectiles[0]);assert.equal(ally.hp,68);assert.equal(ally.healLockUntil,96);assert.equal(b.healTarget(other),undefined);assert.equal(other.hp,1);assert.equal(enemy.hp,1);assert.equal(adjacent.hp,1);
other.targetId=ally.id;b.heal(other);assert.equal(ally.hp,68,'multiple medics cannot stack a heal on one target');
b.tick=96;ally.hp=95;b.heal(other);for(let i=0;i<12;i++)b.stepHeal(b.projectiles.at(-1));assert.equal(ally.hp,100,'healing is capped at maximum hp');
ally.hp=20;ally.dead=true;b.tick=200;b.heal(other);assert.equal(ally.hp,20,'no revival');ally.dead=false;
ally.knockFrame=1;assert.equal(b.healTarget(medic),undefined);ally.knockFrame=0;ally.x=181;assert.equal(b.healTarget(medic),undefined);
// In-flight state must survive checkpoints; a dead recipient cannot be revived.
const flight=make(),healer=flight.spawn(0,105,3,0),patient=flight.spawn(1,1,3,120);patient.hp=40;healer.targetId=patient.id;flight.heal(healer);
const orb=flight.projectiles[0];for(let i=0;i<4;i++)flight.stepHeal(orb);
assert.equal(orb.y,-66,'healing bolt translates horizontally like the original attack bolt');assert.equal(orb.vy,0);
const restoredFlight=Battle.restore(flight.snapshot());assert.equal(packet({battle:flight,seats:[],status:'playing'}).arrows[0][8],'heal');
for(let i=0;i<8;i++){flight.stepHeal(orb);restoredFlight.stepHeal(restoredFlight.projectiles[0]);}assert.equal(patient.hp,58);assert.deepEqual(flight.snapshot(),restoredFlight.snapshot());
const badFlight=restoredFlight.snapshot();badFlight.projectiles[0].age=-1;assert.throws(()=>Battle.restore(badFlight));
const fail=make(),caster=fail.spawn(0,105,3,0),doomed=fail.spawn(1,1,3,100);doomed.hp=1;caster.targetId=doomed.id;fail.heal(caster);doomed.dead=true;fail.stepHeal(fail.projectiles[0]);assert.equal(doomed.hp,1);assert.equal(fail.projectiles[0].done,true);
const release=make(),thrower=release.spawn(0,105,3,0),moving=release.spawn(1,1,3,100);moving.hp=50;thrower.targetId=moving.id;release.heal(thrower);thrower.dead=true;for(let i=0;i<12;i++){moving.x++;release.stepHeal(release.projectiles[0]);}assert.equal(moving.hp,68,'released orb survives caster death and follows recipient');
// No enemy is present. The patient walks beyond acquisition range during wind-up.
for(const direction of [1,-1]){
 const peaceful=make(),doctor=peaceful.spawn(0,105,3,0),walker=peaceful.spawn(1,1,3,170*direction);walker.hp=40;
 let emitted=false,emissionDistance=0;for(let i=0;i<90;i++){peaceful.step();const p=peaceful.projectiles.find(p=>p.kind==='heal');if(p&&!emitted){emitted=true;emissionDistance=Math.abs(walker.x-doctor.x);assert.equal(Math.abs(p.vx),60);assert.equal(p.y,-66);const copy=Battle.restore(peaceful.snapshot());assert.deepEqual(copy.snapshot(),peaceful.snapshot(),'heal in either direction restores');}}
 assert.equal(peaceful.units.some(u=>u.side===1),false);assert.equal(emitted,true,'medic casts without any enemy');assert.equal(walker.hp,58,'walking ally is healed without an enemy to block it');if(direction===1)assert(emissionDistance>180,'fixture reproduces target leaving range during wind-up');
}
// Continuous follow-up care, not merely a successful first heal.
const follow=make(),following=follow.spawn(0,105,3,-1100),walkingPatient=follow.spawn(1,1,3,-930);walkingPatient.hp=40;const heals=[];let previousHp=40;
for(let i=0;i<600;i++){follow.step();if(walkingPatient.hp>previousHp){heals.push({tick:follow.tick,hp:walkingPatient.hp});previousHp=walkingPatient.hp;}}
assert.deepEqual(heals.map(x=>x.hp),[58,76,94,100],'medic catches up and repeatedly heals a marching ally to full');assert(heals.every((h,i)=>i===0||h.tick-heals[i-1].tick>=96),'following does not bypass treatment lock');assert.equal(follow.units.some(u=>u.side===1),false);assert.equal(follow.healFollowTarget(following),undefined,'full-health patient releases escort');
const patrol=make(),pacer=patrol.spawn(0,105,3,0),injured=patrol.spawn(1,1,3,400);injured.hp=40;patrol.move(pacer,{moveAmount:3});assert.equal(pacer.x,6,'bounded catch-up speed');injured.hp=100;patrol.move(pacer,{moveAmount:3});assert.equal(pacer.x,9,'no fast marching when no wounded ally needs help');
const continuous=make(),cm=continuous.spawn(0,105,3,-1100),cp=continuous.spawn(1,1,3,-930);cp.hp=40;for(let i=0;i<100;i++)continuous.step();const checkpoint=Battle.restore(continuous.snapshot());for(let i=0;i<500;i++){continuous.step();checkpoint.step();}assert.deepEqual(continuous.snapshot(),checkpoint.snapshot(),'follow and repeat heal resume deterministically');
const healthy=make(),idleMedic=healthy.spawn(0,105,3,0);healthy.spawn(1,1,3,100);for(let i=0;i<60;i++)healthy.step();assert.equal(healthy.projectiles.some(p=>p.kind==='heal'),false,'full-health allies do not waste healing');
// Basic attacks and heals share spawn coordinates and fixed travel speed.
for(const dir of [1,-1]){const equal=make(),doc=equal.spawn(0,105,3,0),patient=equal.spawn(1,1,3,170*dir),foe=equal.spawn(2,1,3,170*dir);doc.dir=dir;patient.hp=40;doc.targetId=patient.id;equal.heal(doc);doc.targetId=foe.id;equal.fireMagic(doc,'bolt');const [heal,attack]=equal.projectiles;assert.equal(heal.x,attack.x);assert.equal(heal.y,attack.y);assert.equal(heal.vx,attack.vx);for(let i=0;i<2;i++){equal.stepHeal(heal);assert.equal(heal.x,(i+1)*60*dir);}assert.equal(patient.hp,58,'collision heals at travel time, not a fixed half second');}
const c=make(),hunter=c.spawn(1,106,0,-800),victim=c.spawn(2,1,0,800);hunter.targetId=victim.id;c.fire(hunter);assert.equal(c.projectiles[0].entangle,true);assert.equal(hunter.rootReadyAt,168);c.fire(hunter);assert.equal(c.projectiles[1].entangle,undefined);
c.projectiles=[{id:c.nextId++,owner:1,side:0,lane:0,x:798,y:-66,vx:3,vy:0,targetId:victim.id,firerType:106,age:0,entangle:true}];c.random=()=>.5;c.stepUnit=()=>{};c.step();assert.equal(victim.hp,85,'root arrow weaker than ordinary arrow');assert.equal(victim.slowUntil,48);assert.equal(victim.rootImmuneUntil,120);
c.tick=30;c.entangle(victim);assert.equal(victim.slowUntil,48,'no refresh during immunity');c.tick=48;assert.equal(c.slowFactor(victim),1);c.tick=120;c.entangle(victim);assert.equal(victim.slowUntil,168);
const horse=c.spawn(2,4,1,400);c.entangle(horse);assert.equal(c.slowFactor(horse),.75);assert.equal(c.slowFactor(victim),.5);
const shield=c.spawn(2,1,0,800);shield.shield=true;c.projectiles=[{id:c.nextId++,owner:1,side:0,lane:0,x:798,y:-66,vx:3,vy:0,targetId:shield.id,firerType:106,age:0,entangle:true}];c.step();assert.equal(shield.slowUntil,undefined,'shield blocks root');
const motion=make(),foot=motion.spawn(2,1,2,300),cav=motion.spawn(2,4,3,300),front=motion.spawn(0,1,3,270);motion.entangle(foot);motion.move(foot,{moveAmount:10});assert.equal(foot.x,295);cav.speed=30;motion.entangle(cav);motion.move(cav,{});assert.equal(front.knockFrame,undefined,'slowed cavalry below effective charge threshold cannot knock down');
const saved=make(),m=saved.spawn(0,105,3,-200),a=saved.spawn(1,1,3,-100),h=saved.spawn(1,106,3,-1000),v=saved.spawn(2,1,3,800);a.hp=30;saved.entangle(v);saved.decide(m);h.targetId=v.id;saved.fire(h);
const restored=Battle.restore(saved.snapshot());for(let i=0;i<500;i++){saved.step();restored.step();}assert.deepEqual(saved.snapshot(),restored.snapshot(),'support combat resumes deterministically');
const invalid=saved.snapshot();invalid.units[0].healReadyAt=Infinity;assert.throws(()=>Battle.restore(invalid));
const hp=saved.units.find(u=>u.type===1&&!u.dead);if(hp){hp.healPulseUntil=saved.tick+24;hp.slowUntil=saved.tick+48;const msg=packet({battle:saved,seats:[],status:'playing'}),row=msg.units.find(u=>u[0]===hp.id);assert.equal(row[18],hp.healPulseUntil);assert.equal(row[19],hp.slowUntil);}
assert.equal(POOL.some(u=>[105,106].includes(u.type)),false,'new prototypes excluded from AI');
for(const [race,type,source]of [['human2',105,3],['woodelf',106,2]]){assert.strictEqual(C.atlas[race+'-'+type].frameRects,C.atlas[race+'-'+source].frameRects,'exact original frame geometry');assert.strictEqual(C.atlas[race+'-'+type].files,C.atlas[race+'-'+source].files,'unmodified original source images');assert.equal(!!C.atlas[race+'-'+type].healingGlow,type===105,'only medic tints its glow');const army=P.createArmy(race,2000);assert.equal(P.buyUnit(army,type),true);assert.equal(P.buyUnit(P.createArmy('human',2000),type),false);assert.equal(P.eligible(race,type,17),false);}
console.log('PASS native support: ally targeting, healing caps/locks, no revival, weak root arrow, immunity/shields, movement and cavalry, deterministic save, packet effects, native art and shop, AI exclusion');

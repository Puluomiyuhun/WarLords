const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),C=require('./content'),{Battle}=require('./engine'),P=require('./progression'),Campaign=require('./campaign');
function setup(){return new Battle({mode:'duel',races:['persian','human'],rosters:[[0,1,2,5,101,102,103,104],[0,1,2,5]],seed:931});}
assert.equal(C.races.persian.roster.includes(4),false);assert.equal(C.races.persian.roster.includes(6),false);
assert.deepEqual(C.races.persian.baseRoster,[0,1,2,5]);
for(const type of [101,102,103,104]){const a=P.createArmy('persian',10000);assert.ok(P.buyUnit(a,type));assert.equal(P.buyUnit(P.createArmy('human',10000),type),false);assert.ok(C.atlas['persian-'+type]);}
for(const side of [0,1]){
 const b=new Battle({mode:'duel',races:['persian','persian'],rosters:[[0,1,2,5,101,102,103,104],[0,1,2,5,101,102,103,104]]});
 const u=b.spawn(side,102,3,0),enemy=b.spawn(1-side,1,3,u.dir*500);b.hurt(u,10000,enemy);assert.equal(u.downedTicks,72);assert.equal(u.dead,false);assert.equal(b.target(enemy,1000),null);
 for(let i=0;i<72;i++)b.stepUnit(u);assert.equal(u.hp,u.maxHp*.3);b.hurt(u,10000,enemy);assert.equal(u.dead,true,'second death cannot revive');
 const c=setup(),imm=c.spawn(0,102,3,0),foe=c.spawn(1,1,3,100);c.hurt(imm,10000,foe);foe.x=-1;c.stepUnit(imm);assert.equal(imm.dead,true);assert.equal(c.players[1].kills,1);
}
{
 const b=setup(),a=b.spawn(0,102,3,0),v=b.spawn(1,1,3,500);b.hurt(a,10000,v);for(let i=0;i<10;i++)b.step();const r=Battle.restore(b.snapshot());for(let i=0;i<180;i++){b.step();r.step();}assert.deepEqual(b.snapshot(),r.snapshot());
}
function shoot(guardType,open=false,big=false){const b=setup(),archer=b.spawn(0,2,3,-300),guard=b.spawn(1,guardType,3,0),back=b.spawn(1,1,3,100);guard.shield=!open;archer.targetId=back.id;for(const u of b.units)u.frame=1;b.stepUnit=()=>{};b.projectiles.push({id:b.nextId++,owner:0,side:0,lane:3,x:-80,y:-80,vx:40,vy:0,targetId:back.id,firerType:2,age:0,...(big?{visual:'rock',big:true,damage:100}: {})});b.random=()=>.5;for(let i=0;i<6;i++)b.step();return back.hp;}
assert.equal(shoot(101),100,'wicker shield intercepts arrows for ally');assert.ok(shoot(101,true)<100,'open shield cannot protect ally');assert.ok(shoot(101,false,true)<100,'heavy projectile bypasses wicker screen');
{
 const b=setup(),e=b.spawn(0,104,3,0),v=b.spawn(1,1,3,100),s=b.spawn(1,0,3,150),other=b.spawn(1,1,4,120);v.hp=s.hp=1000;e.targetId=v.id;b.attack(e,{range:190,power:85});assert.equal(v.x,135);assert.equal(s.x,156);assert.equal(other.x,120);b.knock(e);assert.equal(e.knockFrame,undefined);
}
{
 const c=Campaign.create('persian',3);assert.deepEqual(c.owned,[26]);assert.ok(Campaign.targets(c).length);assert.deepEqual(Campaign.restore(c),c);assert.equal(Campaign.begin(c,Campaign.targets(c)[0].id).races[0],'persian');
}
{
 const {CoopCampaign}=require('../合作模式预研/coop-campaign.cjs'),{packet}=require('../联机预研/room-server.cjs');
 const c=new CoopCampaign({races:['persian','human']});c.armies[0].gold=10000;for(const type of [101,102,103,104])assert.ok(c.command(0,'buyUnit',type));c.command(0,'ready',true);c.command(1,'ready',true);
 const u=c.battle.spawn(0,102,3,0);c.battle.hurt(u,10000,{owner:2,side:1,lane:3});const p=packet({battle:c.battle,seats:[]});const row=p.units.find(x=>x[0]===u.id);assert.equal(row[15],72);assert.equal(row[16],1);assert.equal(p.races[0],'persian');assert.deepEqual(CoopCampaign.restore(c.snapshot()).snapshot(),c.snapshot());
}
console.log('PASS Persian faction: shared roster/no horses, exclusive recruitment, one-time recovery/crossing/final kill, replay, wicker protection, elephant push/resistance, campaign start and cooperative recovery packets');

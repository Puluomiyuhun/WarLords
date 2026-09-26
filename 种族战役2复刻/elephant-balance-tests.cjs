const assert=require('node:assert/strict'),{Battle}=require('./engine'),C=require('./content');
// Full simulation, not forced attack frames: both directions and several troop spacings.
let cases=0,worst=0;
for(const type of [103,104])for(const side of [0,1])for(const spacing of [0,70,150])for(let seed=1;seed<=30;seed++){
 const b=new Battle({mode:'duel',races:side?['human','persian']:['persian','human'],rosters:side?[[1],[type]]:[[type],[1]],seed});
 const e=b.spawn(side,type,3,side?300:-300);for(let i=0;i<10;i++)b.spawn(1-side,1,3,(side?-1:1)*(300+i*spacing));
 for(let t=0;t<24*30&&!e.dead&&!e.exited;t++)b.step();
 assert.ok(e.dead,`ten unupgraded swords must defeat elephant ${type}, side ${side}, spacing ${spacing}, seed ${seed}`);assert.ok(b.players[side].kills<10);worst=Math.max(worst,b.tick/24);cases++;
}
{
 const b=new Battle({mode:'duel',races:['human','persian'],rosters:[[1],[104]],seed:4}),s=b.spawn(0,1,3,0),e=b.spawn(1,104,3,240);
 assert.equal(b.target(s),e,'sword can target visible front of a large body');const hp=e.hp;s.targetId=e.id;b.random=()=>.5;b.attack(s,{range:100,power:25});assert.ok(e.hp<hp,'sword hit range agrees with target range');
 const afterSword=e.hp;e.x=240;b.impact(s,{range:100,power:30});assert.ok(e.hp<afterSword,'impact weapons use the same large-body distance');
}
assert.equal(C.units[103].health,180);assert.equal(C.units[104].health,300);
console.log(`PASS elephant balance: ${cases} full ten-sword matchups, worst ${worst.toFixed(2)}s, consistent large-body melee reach`);

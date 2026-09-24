const assert=require('node:assert/strict');
const L=require('./layout.js');
// Independent source-derived landmarks at the SWF's native 700 x 500 resolution.
assert.equal(L.width/L.height,1.4);
assert.ok(Math.abs(L.lanes[7].y-439.46)<.01);
assert.ok(Math.abs(L.lanes[0].y-227.07)<.01);
assert.ok(Math.abs(L.lanes[7].sy/L.lanes[0].sy-1.7)<.0001);
assert.ok(Math.abs(L.worldX(-1400,7)-24.28)<.01);
assert.ok(Math.abs(L.worldX(-1400,0)-158.49)<.01);
console.log('PASS source stage, far/near sizes, positions and battlefield edges');
for(let i=0;i<8;i++){
 const r=L.lanes[i];assert.equal(L.pickLane(r.y),i);
 assert.equal(L.pickLane(r.y-5),i);assert.equal(L.pickLane(r.y+5),i);
 assert.ok(L.worldX(-1400,i)>0&&L.worldX(1400,i)<700);
 if(i)assert.ok(r.y>L.lanes[i-1].y&&r.sx>L.lanes[i-1].sx);
}
assert.equal(L.pickLane(-100),0);assert.equal(L.pickLane(900),7);
console.log('PASS pointer selection matches every perspective lane and clamps at boundaries');

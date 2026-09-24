'use strict';
const fs=require('node:fs'),path=require('node:path');
const {CoopCampaign,LEVELS}=require('./coop-campaign.cjs'),{packet,RULES}=require('../联机预研/room-server.cjs');
const c=new CoopCampaign({seed:20260924}),records=[];
for(let stage=0;stage<LEVELS.length;stage++){
 c.command(0,'ready',true);c.command(1,'ready',true);let peak=0,bytes=0,maxBytes=0,n=0;const start=performance.now();
 while(c.phase==='battle'){c.battle.ai(0);c.battle.ai(1);c.step();peak=Math.max(peak,c.battle.units.length);if(c.battle.tick%3===0){const r={code:'benchmark',battle:c.battle,status:'playing',seats:c.armies.map(a=>({race:a.race,ready:true,seq:0}))};const len=Buffer.byteLength(JSON.stringify({...packet(r),type:'coopState',campaign:c.view()}));bytes+=len;maxBytes=Math.max(maxBytes,len);n++;}}
 const ms=performance.now()-start;records.push({level:LEVELS[stage].id,ticks:c.battle.tick,peakUnits:peak,averageBytes:Math.round(bytes/n),maxBytes,perClientKiBPerSecond:+(bytes/n*8/1024).toFixed(2),meanSimulationAndEncodingMsPerTick:+(ms/c.battle.tick).toFixed(4),victory:c.lastResult.victory});
}
const result={rules:RULES,note:'Local unpaced simulation and JSON encoding, two allied AIs, excludes TLS/TCP headers, loss and asset downloads; not iPhone or public-network measurement.',records};fs.writeFileSync(path.join(__dirname,'coop-benchmark-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

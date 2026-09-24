'use strict';
const fs=require('node:fs'),path=require('node:path');
const {Battle}=require('../种族战役2复刻/engine.js');
const {packet,RULES}=require('./room-server.cjs');
const results=[];
for(const races of [['human','orc2'],['undead','troll'],['elf','demon']]){
 const battle=new Battle({seed:20260924,mode:'watch',races});
 const room={code:'benchmark',status:'playing',battle,seats:races.map(race=>({race,ready:true,seq:0}))};
 let maxUnits=0,bytes=0,maxBytes=0,samples=0;const start=performance.now();
 while(battle.tick<8000&&battle.winner===null){battle.step();maxUnits=Math.max(maxUnits,battle.units.length);if(battle.tick%3===0){const n=Buffer.byteLength(JSON.stringify(packet(room)));bytes+=n;maxBytes=Math.max(maxBytes,n);samples++;}}
 const elapsed=performance.now()-start;
 results.push({races,ticks:battle.tick,scores:battle.scores,maxUnits,simulationAndSerializationMs:+elapsed.toFixed(2),averageMsPerTick:+(elapsed/battle.tick).toFixed(4),averageSnapshotBytes:Math.round(bytes/samples),maxSnapshotBytes:maxBytes,estimatedPerClientKiBPerSecond:+(bytes/samples*8/1024).toFixed(2)});
}
const result={rules:RULES,date:'2026-09-24',node:process.version,note:'Local unpaced CPU + JSON benchmark; 8 snapshots/s, excluding TLS/TCP/WebSocket headers and retransmissions. Not iPhone measurements or server capacity guarantee.',results};
fs.writeFileSync(path.join(__dirname,'benchmark-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

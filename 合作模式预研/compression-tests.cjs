'use strict';
const assert=require('node:assert/strict'),{startCoopServer,RULES}=require('./coop-room-server.cjs'),WS=require('../联机预研/vendor/ws');
async function main(){
 const s=await startCoopServer({port:0,manual:true});const clients=[];
 function client(compress){const ws=new WS('ws://127.0.0.1:'+s.port,{perMessageDeflate:compress});clients.push(ws);const messages=[];ws.on('message',d=>messages.push(JSON.parse(d)));ws.on('error',()=>{});return {ws,send:m=>ws.send(JSON.stringify({rules:RULES,protocol:2,...m})),wait:async predicate=>{const start=Date.now();while(Date.now()-start<5000){const m=messages.find(predicate);if(m)return m;await new Promise(r=>setTimeout(r,5));}throw Error('message timeout');}};}
 try{
  const a=client(true),b=client(false);await Promise.all([a,b].map(c=>new Promise((yes,no)=>{c.ws.once('open',yes);c.ws.once('error',no)})));
  assert.match(a.ws.extensions,/permessage-deflate/);assert.equal(b.ws.extensions,'');
  a.send({type:'create',race:'undead',mode:'endless'});const welcome=await a.wait(m=>m.type==='welcome');b.send({type:'join',race:'human',room:welcome.room});await b.wait(m=>m.type==='welcome');
  for(const c of [a,b])c.send({type:'command',action:'ready',value:true,seq:1});
  const first=await a.wait(m=>m.type==='coopState'&&m.campaign.phase==='battle');await b.wait(m=>m.type==='coopState'&&m.campaign.phase==='battle');
  for(const c of [a,b])c.send({type:'loaded',round:first.round});
  await a.wait(m=>m.type==='coopState'&&m.status==='playing');await b.wait(m=>m.type==='coopState'&&m.status==='playing');
  s.advance(2);const [x,y]=await Promise.all([a,b].map(c=>c.wait(m=>m.type==='coopState'&&m.tick===2)));assert.deepEqual(x,y);
  s.advance(200);const [latestA,latestB]=await Promise.all([a,b].map(c=>c.wait(m=>m.type==='coopState'&&m.tick===202)));assert.deepEqual(latestA,latestB);
  console.log('PASS compressed and uncompressed clients: join, prepare, load and identical battle state');
 }finally{for(const ws of clients)ws.terminate();await s.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});

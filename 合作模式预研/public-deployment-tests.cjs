'use strict';
const assert=require('node:assert/strict');
const {startLocal,publicConfig}=require('../种族战役2复刻/coop-local-server.cjs');
const {WebSocket}=require('../联机预研/vendor/ws');
const {RULES,PROTOCOL}=require('./coop-room-server.cjs');
const origin='https://game.example.test',prefix='/warlords2';
async function connect(url,site){const ws=new WebSocket(url,site?{origin:site}:{});await new Promise((ok,no)=>{ws.once('open',ok);ws.once('error',no);});return ws;}
function message(ws,body,match){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',read);reject(Error('message timeout'));},3000);function read(raw){const m=JSON.parse(raw);if(match(m)){clearTimeout(timer);ws.off('message',read);resolve(m);}}ws.on('message',read);ws.send(JSON.stringify(body));});}
function rejected(url,site){return new Promise((resolve,reject)=>{const ws=new WebSocket(url,site?{origin:site}:{});ws.on('unexpected-response',(_req,res)=>{res.resume();ws.terminate();resolve(res.statusCode);});ws.on('open',()=>{ws.terminate();reject(Error('unexpected accepted socket'));});ws.on('error',()=>{});});}
(async()=>{
 assert.deepEqual(publicConfig(origin+prefix+'/'),{origin,basePath:prefix});
 assert.throws(()=>publicConfig('https://u:p@example.test/'));assert.throws(()=>publicConfig(origin+'/?secret=x'));
 const s=await startLocal({port:0,manual:true,publicUrl:origin+prefix,maxRooms:1}),base='http://127.0.0.1:'+s.port,wsurl=base.replace('http:','ws:')+prefix+'/ws';
 const peers=[];
 try{
  const redirect=await fetch(base+prefix,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),prefix+'/');
  for(const file of ['/','/coop.html','/coop.js','/assets/hud-metal.png'])assert.equal((await fetch(base+prefix+file)).status,200,file);
  const health=await(await fetch(base+prefix+'/coop-health')).json();assert.equal(health.version,2);assert.equal(health.public,true);assert.equal(health.basePath,prefix);
  for(const url of ['/coop.html',prefix+'/.env',prefix+'/../coop.html',prefix+'/coop-local-server.cjs',prefix+'/%2e%2e%5c合作模式预研%5clevels.json'])assert.equal((await fetch(base+url)).status,404,url);
  assert.equal(await rejected(wsurl,'https://unrelated.example'),401);assert.equal(await rejected(wsurl),401);
  const a=await connect(wsurl,origin);peers.push(a);
  const old=await message(a,{type:'create',race:'human',rules:RULES,protocol:1},m=>m.type==='error');assert.equal(old.reason,'rules');
  const welcome=await message(a,{type:'create',race:'human',rules:RULES,protocol:PROTOCOL},m=>m.type==='welcome');assert.equal(welcome.owner,0);
  const b=await connect(wsurl,origin);peers.push(b);
  const full=await message(b,{type:'create',race:'elf',rules:RULES,protocol:PROTOCOL},m=>m.type==='error');assert.equal(full.reason,'room_limit');
  await message(a,{type:'leave'},m=>m.type==='coopState'&&m.status==='ended');s.rooms.sweep();assert.equal(s.rooms.rooms.size,0);
  const next=await message(b,{type:'create',race:'elf',rules:RULES,protocol:PROTOCOL},m=>m.type==='welcome');assert.equal(next.owner,0);
  console.log('PASS public subpath routing, redirect, assets, strict origins, protocol mismatch, room capacity and cleanup');
 }finally{for(const ws of peers)ws.terminate();await s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

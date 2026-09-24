'use strict';
const assert=require('node:assert/strict');
const {startLocal}=require('../种族战役2复刻/coop-local-server.cjs');
const {WebSocket}=require('../联机预研/vendor/ws');
(async()=>{const s=await startLocal({port:0,manual:true}),base=`http://127.0.0.1:${s.port}`;try{
 assert.equal((await (await fetch(base+'/coop-health')).json()).app,'warlords2-local-coop');
 for(const f of ['coop.html','coop.js','coop.css','shop-ui.js','shop.css','shop-source-data.js','content.js','layout.js','assets/forest.jpg','assets/shop-portrait-frame.png','assets/shop-detail-frame.png','assets/shop-divider.png','assets/shop-source-human-0.png','assets/shop-upgrade-special.png']){const r=await fetch(base+'/'+f);assert.equal(r.status,200,f);assert.notEqual(r.headers.get('content-type'),null);await r.arrayBuffer();}
 const head=await fetch(base+'/assets/forest.jpg',{method:'HEAD'});assert.equal(head.status,200);assert.ok(+head.headers.get('content-length')>0);assert.equal((await head.text()).length,0);
 assert.equal((await fetch(base+'/coop-local-server.cjs')).status,404);assert.equal((await fetch(base+'/%2e%2e%5c合作模式预研%5clevels.json')).status,404);assert.equal((await fetch(base+'/coop.html',{method:'POST'})).status,405);
 const ws=new WebSocket(base.replace('http:','ws:')+'/ws',{origin:base});await new Promise((yes,no)=>{ws.once('open',yes);ws.once('error',no);});const closed=new Promise(resolve=>ws.once('close',resolve));ws.close();await closed;
 const blocked=await new Promise(resolve=>{const bad=new WebSocket(base.replace('http:','ws:')+'/ws',{origin:'https://unrelated.example'});bad.on('unexpected-response',(_req,res)=>{res.resume();bad.terminate();resolve(res.statusCode);});bad.on('error',()=>{});});assert.equal(blocked,401);
 console.log('PASS local HTTP assets, health, HEAD, file boundaries, methods and same-origin WebSocket upgrade');
}finally{await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

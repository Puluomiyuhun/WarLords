'use strict';
const assert=require('node:assert/strict');
const {WebSocket}=require('./vendor/ws');
const {startServer,RULES}=require('./room-server.cjs');
const all=[];
async function connect(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}`),queue=[],waiters=[];
 ws.on('message',raw=>{const m=JSON.parse(raw);const i=waiters.findIndex(w=>w.test(m));if(i>=0){const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else queue.push(m);});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 const client={ws,send:m=>ws.send(JSON.stringify(m)),next(test){const i=queue.findIndex(test);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={test,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Timed out waiting for message'));},4000)};waiters.push(w);});}};
 all.push(client);return client;
}
async function run(){const server=await startServer({port:0,manual:true});let checks=0;
 try{
 const a=await connect(server.port),b=await connect(server.port),third=await connect(server.port);
 a.send({type:'create',rules:'wrong',race:'human'});assert.equal((await a.next(m=>m.type==='error')).reason,'rules_mismatch');
 a.send({type:'create',rules:RULES,race:'human'});const wa=await a.next(m=>m.type==='welcome');
 b.send({type:'join',rules:RULES,room:wa.room,race:'orc2'});const wb=await b.next(m=>m.type==='welcome');assert.equal(wb.side,1);
 third.send({type:'join',rules:RULES,room:wa.room,race:'elf'});assert.equal((await third.next(m=>m.type==='error')).reason,'room_full');checks++;
 a.send({type:'ready'});b.send({type:'ready'});await a.next(m=>m.type==='state'&&m.status==='playing');const room=server.rooms.get(wa.room);
 async function command(client,seq,action,value,side){client.send({type:'command',seq,action,value,side});return client.next(m=>m.type==='ack'&&m.seq===seq);}
 assert.equal((await command(a,1,'select',20)).ok,false);assert.equal((await command(a,2,'select',32,1)).ok,true);assert.equal(room.battle.players[0].selected,32);assert.equal(room.battle.players[1].selected,0);checks++;
 assert.equal((await command(a,3,'send')).ok,false);server.advance(240);assert.equal((await command(a,4,'send')).ok,true);assert.equal(room.battle.players[0].spawned,1);
 server.advance(240);assert.equal((await command(a,4,'send')).reason,'duplicate');assert.equal(room.battle.players[0].spawned,1);checks++;
 assert.equal((await command(b,1,'select',20)).ok,true);assert.equal((await command(b,2,'send')).ok,true);
 server.advance(3);const tick=room.battle.tick;const sa=await a.next(m=>m.type==='state'&&m.tick===tick),sb=await b.next(m=>m.type==='state'&&m.tick===tick);assert.deepEqual(sa,sb);assert.ok(sa.units.some(u=>u[2]===20));checks++;
 const closed=new Promise(resolve=>b.ws.once('close',resolve));b.ws.close();await closed;await a.next(m=>m.type==='state'&&m.status==='paused');const paused=room.battle.tick;server.advance(240);assert.equal(room.battle.tick,paused);
 third.send({type:'resume',room:wa.room,rules:RULES,token:'wrong'});assert.equal((await third.next(m=>m.type==='error')).reason,'token');
 third.send({type:'resume',room:wa.room,rules:RULES,token:wb.token});const wr=await third.next(m=>m.type==='welcome');assert.equal(wr.side,1);await third.next(m=>m.type==='state'&&m.status==='playing');server.advance(3);assert.equal(room.battle.tick,paused+3);assert.equal((await command(third,2,'send')).reason,'duplicate');checks++;
 assert.equal((await command(a,5,'lane',8)).ok,false);assert.equal((await command(a,6,'auto','true')).ok,false);assert.equal((await command(a,7,'health',999999)).ok,false);assert.equal((await command(a,8,'lane',7)).ok,true);checks++;
 a.ws.send('{');assert.equal((await a.next(m=>m.type==='error')).reason,'bad_json');checks++;
 console.log(`${checks} network checks passed: room/rules, side/roster authority, cooldown/dedup, shared state, pause/reconnect, invalid inputs, malformed JSON.`);
 }finally{for(const c of all)c.ws.terminate();await server.close();}
 const realtime=await startServer({port:0});try{const x=await connect(realtime.port),y=await connect(realtime.port);x.send({type:'create',rules:RULES,race:'elf'});const w=await x.next(m=>m.type==='welcome');y.send({type:'join',rules:RULES,room:w.room,race:'demon'});await y.next(m=>m.type==='welcome');x.send({type:'ready'});y.send({type:'ready'});await x.next(m=>m.type==='state'&&m.status==='playing');const start=performance.now();const end=await x.next(m=>m.type==='state'&&m.tick>=48);const elapsed=performance.now()-start;assert.ok(elapsed>1500&&elapsed<3500);console.log(`Real timer / two WebSocket clients: ${end.tick} ticks in ${elapsed.toFixed(0)} ms.`);}finally{for(const c of all)c.ws.terminate();await realtime.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});

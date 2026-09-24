/* Local research harness. Deliberately binds loopback; not a production service. */
'use strict';
const {WebSocketServer,WebSocket}=require('./vendor/ws');
const {randomBytes,randomInt}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const C=require('../种族战役2复刻/content.js');
const {Battle,FPS}=require('../种族战役2复刻/engine.js');
const RULES=C.rulesVersion;
function packet(room){const b=room.battle;return {
 type:'state',rules:RULES,room:room.code,status:room.status,
 tick:b?.tick??0,winner:room.winner??b?.winner??null,
 races:b?.options.races??room.seats.map(s=>s?.race??null),ready:room.seats.map(s=>!!s?.ready),connected:room.seats.map(s=>!!s?.ws),
 ack:room.seats.map(s=>s?.seq??0),scores:b?.scores??[0,0],
 players:b?.players.map(p=>[p.selected,p.lane,p.charge,p.auto,p.special])??[],
 // id, side, unit, lane, x, animation frame, hp, dead, death age, knock frame, hit flash
 units:b?.units.map(u=>[u.id,u.side,u.type,u.lane,+u.x.toFixed(2),u.frame,u.hp,+u.dead,u.ageDead,u.knockFrame||0,u.flash,u.owner??u.side,u.specialLevel??1])??[],
 arrows:b?.projectiles.map(p=>[p.id,p.side,p.lane,+p.x.toFixed(2),+p.y.toFixed(2),+p.vx.toFixed(2),+p.vy.toFixed(2),p.owner??p.side,p.kind??p.visual??'arrow',p.frame??p.age,p.dir??(p.side===0?1:-1)])??[]
};}
async function startServer({port=18640,manual=false,graceMs=30000}={}){
 const rooms=new Map(),clients=new Set();let roomCounter=0;
 const wss=new WebSocketServer({host:'127.0.0.1',port,maxPayload:2048,perMessageDeflate:false,
  verifyClient:({origin})=>!origin||/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)});
 await new Promise((resolve,reject)=>{wss.once('listening',resolve);wss.once('error',reject);});
 function send(ws,message){if(ws?.readyState===WebSocket.OPEN){if(ws.bufferedAmount>256*1024){ws.close(1013,'slow reader');return;}ws.send(JSON.stringify(message));}}
 function broadcast(r){const p=packet(r);for(const s of r.seats)send(s?.ws,p);}
 function fail(ws,reason){send(ws,{type:'error',reason});}
 function claim(ws,r,side,seat){ws.room=r;ws.side=side;seat.ws=ws;seat.missingSince=0;r.seats[side]=seat;send(ws,{type:'welcome',room:r.code,side,token:seat.token,rules:RULES});broadcast(r);}
 wss.on('connection',ws=>{
  clients.add(ws);ws.windowAt=performance.now();ws.count=0;
  ws.on('error',()=>{});
  ws.on('message',(raw,binary)=>{
   if(binary)return fail(ws,'text_only');
   const now=performance.now();if(now-ws.windowAt>=1000){ws.windowAt=now;ws.count=0;}if(++ws.count>30)return fail(ws,'rate_limit');
   let m;try{m=JSON.parse(raw);}catch{return fail(ws,'bad_json');}
   if(!m||typeof m!=='object'||Array.isArray(m))return fail(ws,'bad_message');
   if(!ws.room){
    if(m.rules!==RULES)return fail(ws,'rules_mismatch');
    if(m.type==='create'){
     if(rooms.size>=16)return fail(ws,'room_limit');
     if(!Object.hasOwn(C.races,m.race))return fail(ws,'race');
     const code=(++roomCounter).toString(36).toUpperCase()+'-'+randomBytes(4).toString('hex');
     const r={code,seats:[null,null],status:'waiting',battle:null,created:now};rooms.set(code,r);
     return claim(ws,r,0,{race:m.race,ready:false,token:randomBytes(24).toString('hex'),seq:0});
    }
    const r=rooms.get(m.room);if(!r)return fail(ws,'room_missing');
    if(m.type==='join'){
     if(r.seats[1])return fail(ws,'room_full');
     if(!Object.hasOwn(C.races,m.race))return fail(ws,'race');
     return claim(ws,r,1,{race:m.race,ready:false,token:randomBytes(24).toString('hex'),seq:0});
    }
    if(m.type==='resume'){
     const side=r.seats.findIndex(s=>s&&s.token===m.token);if(side<0)return fail(ws,'token');
     const seat=r.seats[side];if(seat.ws)return fail(ws,'already_connected');
     if(r.status==='ended'||now-seat.missingSince>graceMs)return fail(ws,'expired');
     claim(ws,r,side,seat);if(r.battle&&r.seats.every(s=>s?.ws)){r.status='playing';broadcast(r);}return;
    }
    return fail(ws,'handshake');
   }
   const r=ws.room,s=r.seats[ws.side];
   if(m.type==='ready'&&r.status==='waiting'){
    s.ready=true;
    if(r.seats.every(s=>s?.ready&&s.ws)){r.battle=new Battle({seed:randomInt(1,0xffffffff),mode:'duel',races:r.seats.map(s=>s.race)});r.status='playing';}
    return broadcast(r);
   }
   if(m.type==='command'){
    if(!Number.isSafeInteger(m.seq)||m.seq<=0)return fail(ws,'sequence');
    if(m.seq<=s.seq)return send(ws,{type:'ack',seq:m.seq,ok:false,reason:'duplicate'});
    if(r.status!=='playing')return fail(ws,'paused');
    // Side, health, damage, RNG, time and charge are never accepted from clients.
    s.seq=m.seq;const ok=r.battle.command(ws.side,m.action,m.value,false);
    return send(ws,{type:'ack',seq:m.seq,ok,tick:r.battle.tick});
   }
   fail(ws,'message_type');
  });
  ws.on('close',()=>{clients.delete(ws);const r=ws.room,s=r?.seats[ws.side];if(s?.ws!==ws)return;s.ws=null;s.missingSince=performance.now();if(r.status==='playing')r.status='paused';broadcast(r);});
 });
 function advance(count=1){for(let n=0;n<count;n++)for(const r of rooms.values()){
  if(r.status==='playing'){r.battle.step();if(r.battle.winner!==null)r.status='ended';if(r.battle.tick%3===0||r.status==='ended')broadcast(r);}
 }}
 let previous=performance.now(),acc=0;
 const timer=manual?null:setInterval(()=>{
  const now=performance.now();acc+=Math.min(250,now-previous);previous=now;
  while(acc>=1000/FPS){advance();acc-=1000/FPS;}
  for(const [code,r]of rooms){const missing=r.seats.findIndex(s=>s&&!s.ws&&now-s.missingSince>graceMs);
   if(missing>=0&&r.status!=='ended'){r.status='ended';r.winner=r.battle?1-missing:null;broadcast(r);}
   if(now-r.created>600000){for(const s of r.seats)s?.ws?.close(1000,'room expired');rooms.delete(code);}
  }
 },10);
 return {port:wss.address().port,rooms,advance,close:async()=>{clearInterval(timer);for(const ws of clients)ws.terminate();await new Promise(resolve=>wss.close(resolve));}};
}
module.exports={startServer,packet,RULES};
if(require.main===module)startServer().then(server=>{console.log(`Local research server: ws://127.0.0.1:${server.port} (rules ${RULES})`);process.once('SIGINT',async()=>{await server.close();process.exit(0);});}).catch(e=>{console.error(e);process.exitCode=1;});

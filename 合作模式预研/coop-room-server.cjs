/* Local cooperative rooms: authoritative simulation and two allied seats. */
'use strict';
const {WebSocketServer,WebSocket}=require('../联机预研/vendor/ws'),{randomBytes,randomInt}=require('node:crypto');
const {CoopCampaign,LEVELS}=require('./coop-campaign.cjs'),{packet,RULES}=require('../联机预研/room-server.cjs'),P=require('../种族战役2复刻/progression.js'),C=require('../种族战役2复刻/content.js');
const {CoopConquest}=require('./coop-conquest.cjs');
const {CoopEndless}=require('./coop-endless.cjs');
const PROTOCOL=2;
async function startCoopServer({port=18641,manual=false,httpServer,graceMs=30000,snapshotEvery=2,allowedOrigin=null,basePath="",maxClients=64,maxRooms=16}={}){
 const rooms=new Map(),clients=new Set();
 if(![snapshotEvery,maxClients,maxRooms].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('invalid room limits');
 const originAllowed=origin=>allowedOrigin?origin===allowedOrigin:!origin||/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
 // Battle snapshots repeat many fields. Bound compression work and memory;
 // clients without this extension still receive ordinary JSON frames.
 const server=new WebSocketServer({...(httpServer?{server:httpServer,path:basePath+'/ws'}:{host:'127.0.0.1',port}),maxPayload:2048,perMessageDeflate:{threshold:1024,serverNoContextTakeover:true,clientNoContextTakeover:true,concurrencyLimit:2,zlibDeflateOptions:{level:3,memLevel:7}},verifyClient:({origin})=>clients.size<maxClients&&originAllowed(origin)});
 if(!httpServer)await new Promise((yes,no)=>{server.once('listening',yes);server.once('error',no);});
 function send(ws,m){if(ws?.readyState===WebSocket.OPEN){if(ws.bufferedAmount>262144)return ws.close(1013,'slow reader');ws.send(typeof m==='string'?m:JSON.stringify(m));}}
 function syncRound(r){if(r.battle!==r.campaign.battle){r.battle=r.campaign.battle;r.round++;r.paused=false;for(const s of r.seats)if(s)s.loaded=0;}}
 function activeSeats(r){return r.campaign.solo?r.seats.slice(0,1):r.seats;}
 function allLoaded(r){return activeSeats(r).every(s=>s?.loaded===r.round);}
 function state(r){syncRound(r);r.status=r.ended?'ended':!activeSeats(r).every(s=>s?.ws)?'waiting':r.campaign.phase==='battle'?!allLoaded(r)?'loading':r.paused?'paused':'playing':r.campaign.phase;const level=r.campaign.level();return {...packet(r),type:'coopState',protocol:PROTOCOL,round:r.round,loaded:r.seats.map(s=>s?.loaded===r.round),manualPause:!!r.paused,raceSelection:r.pickRaces??null,campaign:{...r.campaign.view(),levelConfig:level,levelCount:r.campaign.mode==='endless'?null:r.campaign.mode==='conquest'?27:LEVELS.length},battleConfig:r.battle?.options??null};}
 function sendSnapshot(ws,s){
  if(ws?.readyState!==WebSocket.OPEN)return;
  if(ws.snapshotSending){ws.pendingSnapshot=s;return;}
  ws.snapshotSending=true;
  ws.send(s,error=>{ws.snapshotSending=false;const next=ws.pendingSnapshot;ws.pendingSnapshot=null;if(!error&&next)sendSnapshot(ws,next);});
 }
 function broadcast(r,transient=false){const s=JSON.stringify(state(r));for(const seat of r.seats){const ws=seat?.ws;if(transient)sendSnapshot(ws,s);else {if(ws)ws.pendingSnapshot=null;send(ws,s);}}}
 function error(ws,reason){send(ws,{type:'error',reason});}
 function bind(ws,r,owner,seat){r.seats[owner]=seat;seat.ws=ws;seat.loaded=0;seat.missing=0;ws.room=r;ws.owner=owner;send(ws,{type:'welcome',room:r.code,owner,token:seat.token,rules:RULES,protocol:PROTOCOL,seq:seat.seq});broadcast(r);}
 server.on('connection',ws=>{clients.add(ws);ws.started=performance.now();ws.connectedAt=ws.started;ws.messages=0;ws.alive=true;ws.on('pong',()=>ws.alive=true);ws.on('error',()=>{});
  ws.on('message',(raw,binary)=>{if(binary)return error(ws,'text_only');const now=performance.now();if(now-ws.started>1000){ws.started=now;ws.messages=0;}if(++ws.messages>60)return ws.close(1008,'rate limit');if(ws.messages>30)return error(ws,'rate_limit');let m;try{m=JSON.parse(raw);}catch{return error(ws,'json');}if(!m||typeof m!=='object'||Array.isArray(m))return error(ws,'message');
   if(!ws.room){if(m.rules!==RULES||m.protocol!==PROTOCOL)return error(ws,'rules');
    if(m.type==='auto'){if(!['conquest','endless'].includes(m.mode))return error(ws,'mode');if(!Object.hasOwn(C.races,m.race))return error(ws,'race');const waiting=[...rooms.values()].find(r=>!r.ended&&!r.campaign.solo&&r.seats[0]?.ws&&!r.seats[1]&&r.campaign.phase==='shop'&&(!m.chooseRace||r.pickRaces&&r.campaign.mode===m.mode));if(waiting){waiting.campaign.armies[1]=P.createArmy(m.race,waiting.campaign.mode==='endless'?3000:500);if(waiting.campaign.mode==='endless')waiting.campaign.armies[1].mercenaries=true;return bind(ws,waiting,1,{race:m.race,token:randomBytes(24).toString('hex'),seq:0});}if(m.joinOnly)return error(ws,'no_waiting');m.type='create';}
    if(m.type==='create'){if(m.mode!==undefined&&!['classic','conquest','endless','soloEndless'].includes(m.mode))return error(ws,'mode');if(rooms.size>=maxRooms)return error(ws,'room_limit');if(!Object.hasOwn(C.races,m.race))return error(ws,'race');let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));const r={code,seats:[null,null],pickRaces:m.chooseRace===true?[false,false]:null,campaign:new (['endless','soloEndless'].includes(m.mode)?CoopEndless:m.mode==='conquest'?CoopConquest:CoopCampaign)({races:[m.race,'human'],solo:m.mode==='soloEndless',seed:randomInt(1,0xffffffff)}),round:0,battle:null,created:now,activeAt:now};rooms.set(code,r);return bind(ws,r,0,{race:m.race,token:randomBytes(24).toString('hex'),seq:0});}
    const r=rooms.get(String(m.room||'').trim().toUpperCase());if(!r||r.ended)return error(ws,'room');
    if(m.type==='join'){if(r.campaign.solo||r.seats[1])return error(ws,'full');if(!Object.hasOwn(C.races,m.race))return error(ws,'race');r.campaign.armies[1]=P.createArmy(m.race,r.campaign.mode==='endless'?3000:500);if(r.campaign.mode==='endless')r.campaign.armies[1].mercenaries=true;return bind(ws,r,1,{race:m.race,token:randomBytes(24).toString('hex'),seq:0});}
    if(m.type==='resume'){const owner=r.seats.findIndex(s=>s?.token===m.token);if(owner<0)return error(ws,'token');const seat=r.seats[owner];if(seat.ws)return error(ws,'already_connected');if(now-seat.missing>graceMs)return error(ws,'expired');return bind(ws,r,owner,seat);}
    return error(ws,'handshake');
   }
   const r=ws.room,seat=r.seats[ws.owner];if(r.ended)return error(ws,'ended');
   if(m.type==='loaded'){if(m.round===r.round&&r.campaign.phase==='battle'){seat.loaded=r.round;broadcast(r);}return;}
   if(m.type==='leave'){r.ended=true;broadcast(r);return;}
   if(m.type==='command'){
    if(!Number.isSafeInteger(m.seq)||m.seq<=0)return error(ws,'sequence');if(m.seq<=seat.seq)return send(ws,{type:'ack',seq:m.seq,ok:false,reason:'duplicate'});seat.seq=m.seq;
    let ok=false;
    if(activeSeats(r).every(s=>s?.ws)){
     if(r.pickRaces&&!r.pickRaces.every(Boolean)){if(m.action==='race'&&Object.hasOwn(C.races,m.value)){r.campaign.armies[ws.owner]=P.createArmy(m.value,r.campaign.mode==='endless'?3000:500);if(r.campaign.mode==='endless')r.campaign.armies[ws.owner].mercenaries=true;seat.race=m.value;r.pickRaces[ws.owner]=true;ok=true;}}
     else if(m.action==='pause'&&typeof m.value==='boolean'&&r.campaign.phase==='battle'){r.paused=m.value;ok=true;}
     else if(r.campaign.phase!=='battle'||(!r.paused&&allLoaded(r)))ok=r.campaign.command(ws.owner,m.action,m.value);
    }
    if(ok)r.activeAt=now;send(ws,{type:'ack',seq:m.seq,ok});broadcast(r);return;
   }
   if(m.type==='ping')return send(ws,{type:'pong'});error(ws,'message_type');
  });
  ws.on('close',()=>{clients.delete(ws);const r=ws.room,seat=r?.seats[ws.owner];if(seat?.ws===ws){seat.ws=null;seat.missing=performance.now();broadcast(r);}});
 });
 function advance(n=1){for(let i=0;i<n;i++)for(const r of rooms.values()){syncRound(r);if(r.ended||r.paused||!activeSeats(r).every(s=>s?.ws)||!allLoaded(r))continue;const phase=r.campaign.phase;r.campaign.step();if(phase==='battle')r.activeAt=performance.now();if(r.campaign.phase!==phase)broadcast(r);else if(r.campaign.phase==='battle'&&r.campaign.battle.tick%snapshotEvery===0)broadcast(r,true);}}
 function sweep(now=performance.now()){
  for(const ws of clients)if(!ws.room&&now-ws.connectedAt>20000)ws.close(1008,'handshake timeout');
  for(const [code,r]of rooms){
   if(!r.ended&&(r.seats.some(s=>s&&!s.ws&&now-s.missing>graceMs)||now-(r.activeAt??r.created)>3600000||!r.campaign.solo&&!r.seats[1]&&now-r.created>300000)){r.ended=true;broadcast(r);}
   if(r.ended){for(const s of r.seats)s?.ws?.close(1000,'ended');rooms.delete(code);}
  }
 }
 let last=performance.now(),acc=0;const timer=manual?null:setInterval(()=>{const now=performance.now();acc+=Math.min(250,now-last);last=now;while(acc>=1000/24){advance();acc-=1000/24;}sweep(now);},10);
 const heartbeat=manual?null:setInterval(()=>{for(const ws of clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
 return {port:server.address()?.port,rooms,advance,sweep,close:async()=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of clients)ws.terminate();await new Promise(resolve=>server.close(resolve));}};
}
module.exports={startCoopServer,RULES,PROTOCOL};
if(require.main===module)startCoopServer().then(s=>console.log(`Local co-op: ws://127.0.0.1:${s.port}`)).catch(e=>{console.error(e);process.exitCode=1;});

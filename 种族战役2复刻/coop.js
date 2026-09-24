/* Cooperative browser client: renders server snapshots and sends only commands. */
(function(){'use strict';
const $=id=>document.getElementById(id),C=CONTENT,P=Progression,L=BATTLE_LAYOUT,canvas=$('coopCanvas'),ctx=canvas.getContext('2d');
const SESSION='warlords2-coop-seat-v2',COLORS=['#8dc7ee','#ead08b'];
const small=matchMedia('(max-width:900px),(pointer:coarse)').matches,scale=small?.5:1;
const atlasFiles=new Set([...Object.values(C.atlas),...Object.values(C.effects),...Object.values(C.magicAtlas),...Object.values(C.projectileAtlas)].flatMap(m=>m.files));
let loadProgress='',loadFailedRound=-1;
const images=new Map(),pending=new Map();let socket=null,seat=null,state=null,previous=null,receivedAt=0,seq=0,connecting=false,stopped=false,retryTimer,disconnectAt=0,loadTask=null,loadedRound=-1,loadGeneration=0,cardsKey='',armyKey='',oldPhase='',oldStage=-1;
const landscape=matchMedia('(max-height:600px) and (orientation:landscape) and (max-width:1100px)');
let stageWidth=700;
function resizeStage(){
 const viewport=document.querySelector('.coop-viewport'),stage=document.querySelector('.coop-stage'),r=viewport.getBoundingClientRect();
 if(!r.width||!r.height)return;
 // Expand the camera horizontally on phones; the sprites keep a uniform scale.
 const zoom=landscape.matches?r.height/500:r.width/700;
 stageWidth=landscape.matches?r.width/zoom:700;
 stage.style.width=stageWidth+'px';stage.style.setProperty('--stage-scale',zoom);
 canvas.style.width=stageWidth+'px';const width=Math.round(stageWidth*2);if(canvas.width!==width)canvas.width=width;
}
new ResizeObserver(resizeStage).observe(document.querySelector('.coop-viewport'));
landscape.addEventListener('change',resizeStage);
const screenX=x=>x*stageWidth/700;
const names=Object.fromEntries(Object.entries(C.races).map(([k,r])=>[k,r.name]));
const errors={rules:'客户端版本不同，请刷新两个页面。',room:'房间不存在或已结束，请重新创建。',full:'房间已有两名玩家。',token:'重连凭据失效，请重新创建房间。',expired:'断线超过 30 秒，房间已结束。',already_connected:'这个席位已在另一个页面使用。请返回加入页，以另一名玩家加入。',room_limit:'房间已满，请稍后再试。',race:'请选择有效种族。',rate_limit:'操作过快，请稍候。',ended:'房间已结束。'};
function message(t){$('message').textContent=t;}
function saveSeat(){try{if(seat)sessionStorage.setItem(SESSION,JSON.stringify(seat));else sessionStorage.removeItem(SESSION);}catch{}}
function failPending(){for(const p of pending.values()){clearTimeout(p.timer);p.resolve(false);}pending.clear();}
function send(m){if(socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(m));return true;}
function command(action,value){if(!seat||!state||state.status==='ended'||socket?.readyState!==WebSocket.OPEN)return Promise.resolve(false);const id=++seq;return new Promise(resolve=>{pending.set(id,{resolve,timer:setTimeout(()=>{pending.delete(id);resolve(false);message('操作没有收到确认，请检查连接。');},3500)});send({type:'command',seq:id,action,value});});}
function setBusy(v){connecting=v;$('createRoom').disabled=v;$('joinRoom').disabled=v;}
function resetLobby(){document.querySelector('.coop-shell').classList.remove('in-battle','show-room');stopped=true;clearTimeout(retryTimer);failPending();socket?.close();socket=null;seat=null;saveSeat();state=null;loadedRound=-1;loadFailedRound=-1;loadProgress='';loadGeneration++;loadTask=null;cardsKey='';oldPhase='';oldStage=-1;ArmyShop.close();$('room').hidden=true;$('lobby').hidden=false;$('backLobby').hidden=true;$('reloadAssets').hidden=true;$('connection').textContent='选择种族，创建或加入本机房间。';setBusy(false);}
function connect(handshake){
 stopped=false;setBusy(true);const ws=new WebSocket(new URL('ws',location.href).href.replace(/^http/,'ws'));socket=ws;$('connection').textContent=handshake.type==='resume'?'正在恢复原席位…':'正在连接合作服务器…';
 ws.onopen=()=>{if(socket===ws)send({...handshake,rules:C.rulesVersion,protocol:2});};
 ws.onmessage=e=>{if(socket!==ws)return;let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='welcome'){seat={room:m.room,owner:m.owner,token:m.token};seq=m.seq;saveSeat();history.replaceState(null,'','coop.html');setBusy(false);disconnectAt=0;loadedRound=-1;cardsKey='';$('lobby').hidden=true;$('room').hidden=false;$('backLobby').hidden=true;message('');return;}
  if(m.type==='ack'){const p=pending.get(m.seq);if(p){clearTimeout(p.timer);pending.delete(m.seq);p.resolve(m.ok);message(m.ok?'':'操作未执行：请确认双方在线、当前阶段和出兵充能。');}return;}
  if(m.type==='error'){message(errors[m.reason]||'操作未完成：'+m.reason);setBusy(false);if(!seat||['room','token','expired','already_connected','ended','rules'].includes(m.reason)){stopped=true;ws.close();$('backLobby').hidden=false;}return;}
  if(m.type==='coopState')accept(m);
 };
 ws.onerror=()=>message('无法连接合作服务器。本机测试请启动合作脚本；远程游玩请确认服务器在线。');
 ws.onclose=()=>{if(socket!==ws||stopped)return;failPending();setBusy(false);$('connection').textContent='连接中断；另一名玩家的战斗会暂停。';$('backLobby').hidden=false;if(!seat)return;disconnectAt||=performance.now();if(performance.now()-disconnectAt<28000){clearTimeout(retryTimer);retryTimer=setTimeout(()=>connect({type:'resume',room:seat.room,token:seat.token}),1000);}else{message('重连未成功，请重新创建房间。');stopped=true;}};
}
function accept(m){
 if(!seat)return;const phase=m.campaign.phase,changedRound=!state||state.round!==m.round;previous=changedRound?null:state;state=m;receivedAt=performance.now();seq=Math.max(seq,m.ack[seat.owner]||0);
 const c=m.campaign,both=m.connected.every(Boolean);document.querySelector('.coop-shell').classList.toggle('in-battle',phase==='battle');$('roomCode').textContent=m.room;$('secondWindow').href=`coop.html?room=${encodeURIComponent(m.room)}`;
 const label=m.status==='ended'?'房间已结束':m.status==='waiting'?'等待另一名玩家连接 · 断线保留 30 秒':m.status==='loading'?'等待双方素材载入':m.status==='paused'?'双方战斗已暂停':phase==='battle'?'合作战斗进行中':phase==='failed'?'本关失败':phase==='complete'?'全部过关':'双方整备中';$('connection').textContent=`你是玩家 ${seat.owner+1} · ${names[c.armies[seat.owner].race]} · ${label}`;
 for(let i=0;i<2;i++){const a=c.armies[i],p=m.players[i];$(`ally${i}Name`).textContent=`玩家 ${i+1}${seat.owner===i?' · 你':''} — ${names[a.race]}`;$(`ally${i}Status`).textContent=!m.connected[i]?'等待连接':phase==='shop'?`${a.gold} 黄金 · ${c.ready[i]?'已准备':'正在整备'}`:phase==='battle'?`${p?C.units[p[0]].name:'等待'} · 第 ${(p?.[1]??3)+1} 路`:`${a.gold} 黄金`;$(`ally${i}Army`).textContent=a.roster.map(id=>C.units[id].name).join(' / ');}
 $('shopPhase').hidden=phase==='battle';$('coopBattle').hidden=phase!=='battle';$('openShop').hidden=phase!=='shop';$('readyRoom').hidden=phase!=='shop';$('retryRoom').hidden=phase!=='failed';$('openShop').disabled=!both||m.status==='ended';$('readyRoom').disabled=!both||m.status==='ended';$('retryRoom').disabled=!both||m.status==='ended';$('readyRoom').textContent=c.ready[seat.owner]?'取消准备':'准备出战';
 $('phaseTitle').textContent=phase==='complete'?'三关合作试炼完成':phase==='failed'?'防线失守':`${c.level} · 战前整备`;
 $('phaseSummary').textContent=phase==='complete'?'你们已完成全部三个试验关。可结束房间，重新选择种族再玩。':phase==='failed'?'本关没有奖励。已购买部队与升级保留，可以返回商店后重新挑战。':`下一关：${names[c.levelConfig.enemyRace]}，每 ${c.levelConfig.waveInterval/24} 秒一排，持续出兵。推进 ${c.levelConfig.target} 次获胜，防线 ${c.levelConfig.lives} 点。`;
 $('rewardSummary').textContent=c.lastResult?.victory?`上一关胜利 · 两名玩家各获得 ${c.lastResult.reward} 黄金`:'两人各自购物，准备完成后共同开战。';
 const key=JSON.stringify(c.armies[seat.owner]);if(key!==armyKey){armyKey=key;if(ArmyShop.isOpen())ArmyShop.update([c.armies[seat.owner]]);}
 if(phase!=='shop'&&ArmyShop.isOpen())ArmyShop.close();
 if(phase==='battle'){
  $('levelTitle').textContent=c.level;
  $('defense').textContent=`推进 ${c.progress} / ${c.progressMax} · 防线 ${c.defense} / ${c.defenseMax}`;
  $('coopLifeBar').style.width=(100*c.progress/c.progressMax)+'%';
  const remaining=Math.max(0,Math.ceil((c.nextWaveAt-m.tick)/24));
  $('waveInfo').textContent=`敌军已出 ${c.wave} 波 · 下波 ${remaining} 秒`;
  const seconds=Math.floor(m.tick/24);$('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('pauseRoom').textContent=m.manualPause?'继续':'暂停';$('noticeResume').hidden=!m.manualPause||!both||m.status==='ended';$('pauseRoom').disabled=!both||m.status==='ended';updateControls();
  if(loadedRound!==m.round&&!loadTask&&loadFailedRound!==m.round)loadRound(m);
  $('battleNotice').hidden=m.status==='playing'&&loadedRound===m.round;$('battleNoticeText').textContent=m.status==='waiting'?'队友暂时离线\n等待重连，战斗已暂停':m.status==='ended'?'房间已结束':m.manualPause?'双方战斗已暂停':`${loadFailedRound===m.round?'素材下载未完成，请点“重试载入素材”':loadedRound===m.round?'本机已就绪，等待队友载入素材…':'正在载入双方军队… '+loadProgress}\n玩家 1 ${m.loaded[0]?'已就绪':'载入中'} · 玩家 2 ${m.loaded[1]?'已就绪':'载入中'}`;
 }
 if(phase==='shop'&&oldPhase==='battle'&&c.stage!==oldStage&&m.status!=='ended')openShop();oldPhase=phase;oldStage=c.stage;
 if(m.status==='ended'){stopped=true;seat=null;saveSeat();failPending();$('backLobby').hidden=false;ArmyShop.close();message('房间已结束。可以返回创建页，再开一场。');}
}
function openShop(){if(!state||!seat||state.campaign.phase!=='shop')return;ArmyShop.open({title:'合作军备 · 购买由房间确认 · 返回后准备出战',ownerLabel:`玩家 ${seat.owner+1}`,armies:[state.campaign.armies[seat.owner]],enabled:[true],onAction:command,onReady:()=>command('ready',true)});}
function canSpecial(){if(!seat||!state?.players[seat.owner])return false;const type=state.players[seat.owner][0];return P.has(state.campaign.armies[seat.owner].upgrades,type,C.units[type].specialUpgrade);}
function updateControls(){const p=state.players[seat.owner];if(!p)return;const a=state.campaign.armies[seat.owner],key=a.race+':'+a.roster.join(',')+':'+seat.owner;
 if(key!==cardsKey){cardsKey=key;$('myArmyTitle').textContent=`玩家 ${seat.owner+1} · ${names[a.race]}`;document.querySelector('.coop-stage').style.setProperty('--left-info-y',(32+Math.ceil(a.roster.length/5)*52)+'px');$('myCards').replaceChildren();for(const id of a.roster){const b=document.createElement('button'),im=new Image(),meter=document.createElement('i');b.className='unit-card';b.dataset.type=id;b.setAttribute('aria-label','选择 '+C.units[id].name);b.title=C.units[id].name+' · '+(C.units[id].charge/24).toFixed(1)+' 秒';im.className='icon';im.src=`assets/icon-${a.race}-${id}.png`;im.alt='';meter.className='meter';b.append(meter,im);b.onclick=()=>{command('select',id);canvas.focus({preventScroll:true});};$('myCards').append(b);}}
 const d=C.units[p[0]],special=canSpecial(),need=d.charge*(p[4]&&special?2:1),enabled=state.status==='playing'&&loadedRound===state.round;
 $('mySelected').textContent=d.name;$('coopLaneText').textContent=`第 ${p[1]+1} 路`;const buddy=state.players[1-seat.owner],buddyArmy=state.campaign.armies[1-seat.owner];$('buddyName').textContent='盟军 · '+names[buddyArmy.race];$('buddyState').textContent=buddy?`${C.units[buddy[0]].name} · 第 ${buddy[1]+1} 路`:'等待队友';$('myCharge').textContent=p[2]>=need?special&&p[2]>=d.charge*2?'特殊部队就绪':'部队就绪':`充能还需 ${((need-p[2])/24).toFixed(1)} 秒`;$('chargeMeter').value=Math.min(1,p[2]/need);$('coopSend').disabled=!enabled||p[2]<need;$('touchCoopSend').disabled=$('coopSend').disabled;$('coopSpecial').checked=p[4];$('coopSpecial').disabled=!enabled||!special;$('coopAuto').checked=p[3];$('coopAuto').disabled=!enabled;
 for(const b of $('myCards').children){const id=+b.dataset.type,charge=C.units[id].charge;b.classList.toggle('active',id===p[0]);b.classList.toggle('ready',p[2]>=charge);b.classList.toggle('promoted',P.has(a.upgrades,id,C.units[id].specialUpgrade)&&p[2]>=charge*2);b.setAttribute('aria-pressed',String(id===p[0]));b.style.setProperty('--charge',Math.min(100,p[2]/charge*100)+'%');b.disabled=!enabled;}for(const b of $('laneButtons').children){b.classList.toggle('active',+b.dataset.lane===p[1]);b.disabled=!enabled;}
}
async function loadRound(m){const generation=++loadGeneration,round=m.round,config=m.battleConfig;loadTask=true;loadFailedRound=-1;loadProgress='';$('reloadAssets').hidden=true;
 try{const files=[config.terrain+'.jpg','arrow-blue.png','arrow-red.png',...(config.rosters.some(roster=>roster.some(id=>C.units[id].caster))?Object.values(C.magicAtlas).flatMap(x=>x.files):[])];for(let i=0;i<config.races.length;i++){const race=config.races[i];for(const id of config.rosters[i])files.push(...C.atlas[race+'-'+id].files);files.push(...C.effects[race].files);}for(const roster of config.rosters)for(const id of roster){const m=C.projectileAtlas[C.units[id].projectile];if(m)files.push(...m.files);}const keep=new Set(files);for(const file of images.keys())if(!keep.has(file))images.delete(file);
  await GameAssets.batch([...keep],async file=>{if(images.has(file))return;const im=await GameAssets.image('assets/'+(small&&atlasFiles.has(file)?'mobile/':'')+file);if(generation===loadGeneration)images.set(file,im);},(done,total)=>{if(generation===loadGeneration)loadProgress=done+' / '+total;});
  if(generation!==loadGeneration||state?.round!==round)return;loadedRound=round;send({type:'loaded',round});
 }catch(e){if(generation===loadGeneration){loadFailedRound=round;message('素材载入失败：'+e.message+'。点击重试；房间会等你加载完成。');$('reloadAssets').hidden=false;}}
 finally{if(generation===loadGeneration)loadTask=null;}
}
function sprite(m,x,y,sx,sy,dir,frame,alpha=1){if(!m)return;const r=m.frameRects[Math.max(0,Math.min(m.frames-1,frame-1))],im=images.get(m.files[r.page]);if(!im)return;ctx.save();ctx.translate(x,y);ctx.scale(dir*sx,sy);ctx.globalAlpha=alpha;ctx.drawImage(im,r.x*scale,r.y*scale,r.w*scale,r.h*scale,r.ox,r.oy,r.w,r.h);ctx.restore();}
function render(now){requestAnimationFrame(render);if(!seat||!state||state.campaign.phase!=='battle'||loadedRound!==state.round)return;
 ctx.setTransform(2,0,0,2,0,0);const bg=images.get(state.battleConfig.terrain+'.jpg');if(bg)ctx.drawImage(bg,0,0,stageWidth,500);else ctx.clearRect(0,0,stageWidth,500);
 const ratio=state.status==='playing'&&previous?Math.min(1,(now-receivedAt)/Math.max(1,(state.tick-previous.tick)*1000/24)):1,oldUnits=new Map((previous?.units||[]).map(u=>[u[0],u]));
 for(let lane=0;lane<8;lane++){const row=L.lanes[lane];for(const u of state.units.filter(u=>u[3]===lane).sort((a,b)=>b[7]-a[7]||a[0]-b[0])){const old=oldUnits.get(u[0]),x=old?old[4]+(u[4]-old[4])*ratio:u[4],race=state.races[u[11]],unitX=screenX(L.worldX(x,lane));if(u[11]<2&&!u[7]){ctx.fillStyle=COLORS[u[11]];ctx.globalAlpha=.65;ctx.beginPath();ctx.ellipse(unitX,row.y+1,9*row.sx/.12,2,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}sprite(u[9]?C.effects[race]:C.atlas[race+'-'+u[2]],unitX,row.y,2*row.sx,2*row.sy,u[1]===0?1:-1,u[9]||u[5],u[7]?Math.max(0,Math.min(1,(224-u[8])/35)):1);}
  for(const p of state.arrows.filter(p=>p[2]===lane)){if(p[8]!=='arrow'){const meta=C.magicAtlas[p[8]]||C.projectileAtlas[p[8]];sprite(meta,screenX(L.worldX(p[3],lane)),row.y+p[4]*row.sy,2*row.sx,2*row.sy,p[10],C.magicAtlas[p[8]]?p[9]:1+p[9]%meta.frames);continue;}ctx.save();ctx.translate(screenX(L.worldX(p[3],lane)),row.y+p[4]*row.sy);ctx.rotate(Math.atan2(p[6]*row.sy,p[5]*row.sx));ctx.scale(row.sx*2,row.sy*2);ctx.strokeStyle='#493b26';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(12,0);ctx.stroke();ctx.restore();}
 }
 for(let i=0;i<2;i++){const p=state.players[i],row=L.lanes[p[1]],im=images.get(i===0?'arrow-blue.png':'arrow-red.png'),x=screenX(row.x-row.halfWidth)-(i===1?13:0);if(im){ctx.save();ctx.globalAlpha=i===seat.owner?1:.65;ctx.drawImage(im,x-29.5,row.y-19+(i===1?6:0),83,42);ctx.restore();}ctx.fillStyle=COLORS[i];ctx.font='bold 11px sans-serif';ctx.fillText('P'+(i+1),x-30,row.y-22+(i===1?7:0));}
}
for(const [id,r]of Object.entries(C.races)){const o=document.createElement('option');o.value=id;o.textContent=r.name;$('coopRace').append(o);}
for(let i=0;i<8;i++){const b=document.createElement('button');b.textContent=(i+1)+' 路';b.dataset.lane=i;b.onclick=()=>command('lane',i);$('laneButtons').append(b);}
$('createRoom').onclick=()=>{if(!connecting)connect({type:'create',race:$('coopRace').value});};
$('joinRoom').onclick=()=>{const room=$('joinCode').value.trim().toUpperCase();if(!/^[A-F0-9]{8}$/.test(room))return message('请输入完整的 8 位房间码。');if(!connecting)connect({type:'join',race:$('coopRace').value,room});};
$('openShop').onclick=openShop;$('readyRoom').onclick=()=>command('ready',!state.campaign.ready[seat.owner]);$('retryRoom').onclick=()=>command('retry');$('pauseRoom').onclick=()=>command('pause',!state.manualPause);
$('coopSend').onclick=()=>command('send');$('touchCoopSend').onclick=()=>command('send');$('touchCoopPause').onclick=()=>command('pause',!state.manualPause);$('noticeResume').onclick=()=>command('pause',false);$('battleRoomBack').onclick=()=>{command('pause',true);document.querySelector('.coop-shell').classList.toggle('show-room');};$('coopAuto').onchange=()=>{command('auto',$('coopAuto').checked);canvas.focus({preventScroll:true});};$('coopSpecial').onchange=()=>{command('special',$('coopSpecial').checked);canvas.focus({preventScroll:true});};
 $('leaveRoom').onclick=()=>{send({type:'leave'});resetLobby();message('已结束合作房间。');};$('backLobby').onclick=()=>{resetLobby();message('');};$('reloadAssets').onclick=()=>{if(state)loadRound(state);};
$('copyInvite').onclick=async()=>{const url=new URL($('secondWindow').getAttribute('href'),location.href).href;try{await navigator.clipboard.writeText(url);message('邀请地址已复制，在另一浏览器打开即可。');}catch{message('邀请地址：'+url);}};
canvas.onclick=e=>{
 const r=canvas.getBoundingClientRect(),y=(e.clientY-r.top)/r.height*500;
 if(landscape.matches&&(y<L.lanes[0].y-18||y>L.lanes[7].y+22))return;
 command('lane',L.pickLane(y));
 // WebSocket preserves this adjacent lane/send pair; do not await an ack and
 // allow another tap to change the selected lane before this send is queued.
 if(landscape.matches&&state?.status==='playing'&&!$('coopSend').disabled)command('send');
 canvas.focus({preventScroll:true});
};
document.addEventListener('keydown',e=>{if(!seat||state?.campaign.phase!=='battle'||ArmyShop.isOpen()||document.querySelector('dialog[open]')||/^(INPUT|SELECT)$/.test(e.target.tagName))return;const p=state.players[seat.owner],list=state.campaign.armies[seat.owner].roster,keys={KeyW:['lane',Math.max(0,p[1]-1)],ArrowUp:['lane',Math.max(0,p[1]-1)],KeyS:['lane',Math.min(7,p[1]+1)],ArrowDown:['lane',Math.min(7,p[1]+1)],KeyA:['select',list[(list.indexOf(p[0])-1+list.length)%list.length]],ArrowLeft:['select',list[(list.indexOf(p[0])-1+list.length)%list.length]],KeyD:['select',list[(list.indexOf(p[0])+1)%list.length]],ArrowRight:['select',list[(list.indexOf(p[0])+1)%list.length]],Space:['send'],Enter:['send'],KeyE:['special',!p[4]],KeyP:['pause',!state.manualPause]};if(keys[e.code]){e.preventDefault();if(!e.repeat)command(...keys[e.code]);}});
const invite=new URLSearchParams(location.search).get('room');if(invite)$('joinCode').value=invite;
try{const saved=JSON.parse(sessionStorage.getItem(SESSION)||'null');if(saved&&Number.isInteger(saved.owner)&&saved.token&&saved.room){seat=saved;connect({type:'resume',room:saved.room,token:saved.token});}}catch{}
requestAnimationFrame(render);
})();

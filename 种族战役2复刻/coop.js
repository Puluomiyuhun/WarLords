/* Cooperative browser client: renders server snapshots and sends only commands. */
(function(){'use strict';
const $=id=>document.getElementById(id),C=CONTENT,P=Progression,L=BATTLE_LAYOUT,canvas=$('coopCanvas'),ctx=canvas.getContext('2d',{alpha:false});
const SOLO=new URLSearchParams(location.search).get('solo')==='endless';
if(SOLO)$('connection').textContent='正在准备单人无尽军备…';
const SESSION=SOLO?'warlords2-solo-endless-seat-v1':'warlords2-coop-seat-v2',COLORS=['#8dc7ee','#ead08b'];
const small=matchMedia('(max-width:900px),(pointer:coarse)').matches,scale=.5;
const atlasFiles=new Set([...Object.values(C.atlas),...Object.values(C.effects),...Object.values(C.magicAtlas),...Object.values(C.projectileAtlas)].flatMap(m=>m.files));
let loadProgress='',loadFailedRound=-1,loadError='';
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
const errors={no_waiting:'暂时没有同模式的等候房间，请创建房间或稍后再加入。',mode:'请选择有效的合作模式。',rules:'客户端版本不同，请刷新两个页面。',room:'房间不存在或已结束，请重新创建。',full:'房间已有两名玩家。',token:'重连凭据失效，请重新创建房间。',expired:'断线超过 30 秒，房间已结束。',already_connected:'这个席位已在另一个页面使用。请返回加入页，以另一名玩家加入。',room_limit:'房间已满，请稍后再试。',race:'请选择有效种族。',rate_limit:'操作过快，请稍候。',ended:'房间已结束。'};
function message(t){$('message').textContent=t;}
function saveSeat(){try{if(seat)sessionStorage.setItem(SESSION,JSON.stringify(seat));else {sessionStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION+'-info');}}catch{}}
function failPending(){for(const p of pending.values()){clearTimeout(p.timer);p.resolve(false);}pending.clear();}
function send(m){if(socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(m));return true;}
function command(action,value){if(!seat||!state||state.status==='ended'||socket?.readyState!==WebSocket.OPEN)return Promise.resolve(false);const id=++seq;return new Promise(resolve=>{pending.set(id,{resolve,timer:setTimeout(()=>{pending.delete(id);resolve(false);message('操作没有收到确认，请检查连接。');},3500)});send({type:'command',seq:id,action,value});});}
function setBusy(v){connecting=v;$('createRoom').disabled=v;$('matchRoom').disabled=v;$('joinRoom').disabled=v;}
function soloHome(){send({type:'leave'});stopped=true;seat=null;saveSeat();socket?.close();location.href='index.html';}
function soloChoose(){document.documentElement.classList.remove('solo-shop');RacePicker.open({confirmLabel:'进入军备商店 〉',note:'初始3000黄金 · 敌军数量减半',onCancel:soloHome,onConfirm:race=>{connect({type:'create',race,mode:'soloEndless'});return true;}});}
function resetLobby(){if(SOLO){soloHome();return;}RacePicker.close();document.querySelector('.coop-shell').classList.remove('in-battle','show-room');stopped=true;clearTimeout(retryTimer);failPending();socket?.close();socket=null;seat=null;saveSeat();state=null;loadedRound=-1;loadFailedRound=-1;loadProgress='';loadGeneration++;loadTask=null;cardsKey='';oldPhase='';oldStage=-1;ArmyShop.close();$('room').hidden=true;$('lobby').hidden=false;$('backLobby').hidden=true;$('reloadAssets').hidden=true;$('connection').textContent='选择模式，创建房间或自动加入；匹配成功后双方各自选择种族。';setBusy(false);}
function connect(handshake){
 stopped=false;setBusy(true);const ws=new WebSocket(new URL('ws',location.href).href.replace(/^http/,'ws'));socket=ws;$('connection').textContent=handshake.type==='resume'?'正在恢复原席位…':(SOLO?'正在准备单人无尽军备…':'正在连接合作服务器…');
 ws.onopen=()=>{if(socket===ws)send({...handshake,rules:C.rulesVersion,protocol:2});};
 ws.onmessage=e=>{if(socket!==ws)return;let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='welcome'){seat={room:m.room,owner:m.owner,token:m.token};seq=m.seq;saveSeat();history.replaceState(null,'',SOLO?'coop.html?solo=endless':'coop.html');setBusy(false);disconnectAt=0;loadedRound=-1;cardsKey='';$('lobby').hidden=true;$('room').hidden=false;$('backLobby').hidden=true;message('');return;}
  if(m.type==='ack'){const p=pending.get(m.seq);if(p){clearTimeout(p.timer);pending.delete(m.seq);p.resolve(m.ok);message(m.ok?'':'操作未执行：请确认双方在线、当前阶段和出兵充能。');}return;}
  if(m.type==='error'){message(errors[m.reason]||'操作未完成：'+m.reason);setBusy(false);if(!seat||['room','token','expired','already_connected','ended','rules'].includes(m.reason)){stopped=true;ws.close();$('backLobby').hidden=false;}return;}
  if(m.type==='coopState')accept(m);
 };
 ws.onerror=()=>message('无法连接合作服务器。本机测试请启动合作脚本；远程游玩请确认服务器在线。');
 ws.onclose=()=>{if(socket!==ws||stopped)return;failPending();setBusy(false);$('connection').textContent=(SOLO?'连接中断，战斗已暂停，正在重连…':'连接中断；另一名玩家的战斗会暂停。');$('backLobby').hidden=false;if(!seat)return;disconnectAt||=performance.now();if(performance.now()-disconnectAt<28000){clearTimeout(retryTimer);retryTimer=setTimeout(()=>connect({type:'resume',room:seat.room,token:seat.token}),1000);}else{message('重连未成功，请重新创建房间。');stopped=true;}};
}
function accept(m){
 if(!seat)return;const phase=m.campaign.phase,changedRound=!state||state.round!==m.round;previous=changedRound?null:state;state=m;receivedAt=performance.now();seq=Math.max(seq,m.ack[seat.owner]||0);
 const c=m.campaign;if(SOLO)document.documentElement.classList.toggle('solo-shop',phase==='shop');const choosing=Array.isArray(m.raceSelection)&&!m.raceSelection.every(Boolean);if(choosing&&m.connected.every(Boolean)&&!RacePicker.isOpen()&&!m.raceSelection[seat.owner])RacePicker.open({confirmLabel:'确认种族',note:'双方确认种族后进入军备整备',onConfirm:race=>command('race',race),onCancel:()=>{send({type:'leave'});resetLobby();}});if(!choosing&&RacePicker.isOpen())RacePicker.close();try{const info=JSON.stringify({mode:c.mode,race:c.armies[seat.owner].race,wave:c.wave,level:c.level,defense:c.defense});if(sessionStorage.getItem(SESSION+'-info')!==info)sessionStorage.setItem(SESSION+'-info',info);}catch{}const both=c.solo?m.connected[0]:m.connected.every(Boolean);$('supplyOffer').hidden=phase!=='battle'||!c.shopOffer;if(c.shopOffer){$('supplyText').textContent=`第 ${c.shopOffer.wave} 波${c.shopOffer.wave===15?' · 外援已解锁':'补给 · 每人 +'+c.shopOffer.reward+' 金'} · ${c.solo?'点击进入':c.shopOffer.votes.filter(Boolean).length+'/2 同意'}`;$('supplyYes').textContent=c.shopOffer.votes[seat.owner]?'等待队友':'进入商店';$('supplyYes').disabled=!both||c.shopOffer.votes[seat.owner];$('supplySkip').disabled=!both;}document.querySelector('.coop-shell').classList.toggle('in-battle',phase==='battle');document.querySelector('.allies').hidden=!!c.solo;$('copyInvite').hidden=!!c.solo;$('secondWindow').hidden=!!c.solo;$('buddyName').hidden=!!c.solo;$('buddyState').hidden=!!c.solo;$('roomCode').textContent=m.room;$('secondWindow').href=`coop.html?room=${encodeURIComponent(m.room)}`;
 const label=m.status==='ended'?'房间已结束':m.status==='waiting'?'等待另一名玩家连接 · 断线保留 30 秒':m.status==='loading'?'等待双方素材载入':m.status==='paused'?'双方战斗已暂停':phase==='battle'?'合作战斗进行中':phase==='failed'?'本关失败':phase==='complete'?'全部过关':'双方整备中';$('connection').textContent=`你是玩家 ${seat.owner+1} · ${names[c.armies[seat.owner].race]} · ${label}`;
 for(let i=0;i<2;i++){const a=c.armies[i],p=m.players[i];$(`ally${i}Name`).textContent=`玩家 ${i+1}${seat.owner===i?' · 你':''} — ${names[a.race]}`;$(`ally${i}Status`).textContent=!m.connected[i]?'等待连接':phase==='shop'?`${a.gold} 黄金 · ${c.ready[i]?'已准备':'正在整备'}`:phase==='battle'?`${p?C.units[p[0]].name:'等待'} · 第 ${(p?.[1]??3)+1} 路`:`${a.gold} 黄金`;$(`ally${i}Army`).textContent=a.roster.map(id=>C.units[id].name).join(' / ');}
 $('shopPhase').hidden=phase==='battle';$('coopBattle').hidden=phase!=='battle';$('openShop').hidden=phase!=='shop';$('readyRoom').hidden=phase!=='shop';$('retryRoom').hidden=phase!=='failed';$('openShop').disabled=choosing||!both||m.status==='ended';$('readyRoom').disabled=choosing||!both||m.status==='ended';$('retryRoom').disabled=!both||m.status==='ended';$('readyRoom').textContent=c.ready[seat.owner]?'取消准备':'准备出战';
 $('phaseTitle').textContent=phase==='complete'?(c.mode==='conquest'?'共同征服完成':'三关合作试炼完成'):phase==='failed'?(c.mode==='endless'?'无尽挑战结束':'防线失守'):`${c.level} · ${c.intermission?'中场补给（战斗已暂停）':'战前整备'}`;
 $('phaseSummary').textContent=phase==='complete'?'你们已完成本次合作战役。可结束房间，重新选择种族再玩。':phase==='failed'?(c.mode==='endless'?`坚持 ${Math.floor((c.lastResult?.tick||0)/24)} 秒 · 敌军 ${c.lastResult?.waves||0} 波 · 击杀 ${c.lastResult?.kills||0}。装备保留，可重新挑战。`:'本关没有奖励。已购买部队与升级保留，可以返回商店后重新挑战。'):c.mode==='endless'?'全兵种敌军持续混编来袭，波次逐步加快。防线上限 50 点，我方每突破一名恢复 1 点，敌方每突破一名扣除 1 点；防线归零时结束。':`下一关：${(c.levelConfig.enemyRaces||[c.levelConfig.enemyRace]).map(r=>names[r]).join('、')}，每 ${c.levelConfig.waveInterval/24} 秒一排，持续出兵。${c.levelConfig.castle?'攻城积分':'突破数'}达到 ${c.levelConfig.target} 获胜，防线 ${c.levelConfig.lives} 点。`;
 renderMap(c,!choosing&&both&&m.status!=='ended');
 $('rewardSummary').textContent=c.lastResult?.victory?`上一关胜利 · 两名玩家各获得 ${c.lastResult.reward} 黄金`:(c.intermission?(c.solo?'场上士兵与防线保留，完成整备后继续战斗。':'场上士兵与防线保留。卖出只停止后续招募；双方准备后继续战斗。'):(c.solo?'独自守住防线，敌军数量为双人模式的一半。':'两人各自购物，准备完成后共同开战。'));
 const key=JSON.stringify(c.armies[seat.owner]);if(key!==armyKey){armyKey=key;if(ArmyShop.isOpen())ArmyShop.update([c.armies[seat.owner]]);}
 if(phase!=='shop'&&ArmyShop.isOpen())ArmyShop.close();
 if(phase==='battle'){
  $('levelTitle').textContent=c.level;
  $('defense').textContent=c.mode==='endless'?`${SOLO?'防线':'共享防线'} ${c.defense} / ${c.defenseMax} · 突破 ${c.progress}`:`${c.levelConfig.castle?'攻城':'推进'} ${Math.floor(c.progress)} / ${c.progressMax} · 防线 ${c.defense} / ${c.defenseMax}`;
  $('coopLifeBar').style.width=(100*(c.mode==='endless'?c.defense/c.defenseMax:c.progress/c.progressMax))+'%';$('coopLifeBar').parentElement.setAttribute('aria-label',c.mode==='endless'?(SOLO?'防线':'共享防线'):'我军通关进度');
  const remaining=Math.max(0,Math.ceil((c.nextWaveAt-m.tick)/24));
  const waveKind=c.mode==='endless'?({elite:'精英波',siege:'攻城波',monster:'巨兽波'}[c.nextWavePlan?.formation]||'下波'):'下波';
  $('waveInfo').textContent=`已出 ${c.wave} 波 · ${waveKind} ${remaining} 秒后`;
  const seconds=Math.floor(m.tick/24);$('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('pauseRoom').textContent=m.manualPause?'继续':'暂停';$('noticeResume').hidden=!m.manualPause||!both||m.status==='ended';$('pauseRoom').disabled=!both||m.status==='ended';updateControls();
  if(loadedRound!==m.round&&!loadTask&&loadFailedRound!==m.round)loadRound(m);
  updateBattleNotice(m);
 }
 if(phase==='shop'&&m.status!=='ended'&&(SOLO&&!ArmyShop.isOpen()||oldPhase==='battle'&&(c.stage!==oldStage||c.intermission)))openShop();oldPhase=phase;oldStage=c.stage;
 if(choosing){$('phaseTitle').textContent=both?'选择种族':'等待另一位玩家';$('phaseSummary').textContent=both?(m.raceSelection[seat.owner]?'种族已确认，等待队友选择。':'请在种族选择页确认你的军队。'):'房间已创建，另一位玩家点击同模式的加入房间即可匹配。';}if(m.status==='ended'){RacePicker.close();stopped=true;seat=null;saveSeat();failPending();$('backLobby').hidden=false;ArmyShop.close();message('房间已结束。可以返回创建页，再开一场。');}
}
let mapKey='';
function renderMap(c,enabled){
 const panel=$('coopMapPanel');panel.hidden=!c.map||c.phase==='battle';if(panel.hidden)return;
 const key=JSON.stringify([c.map,c.phase,enabled]);if(key===mapKey)return;mapKey=key;
 $('coopMapStatus').textContent=`盟军领土 ${c.map.owned.length} / ${c.map.total} · ${c.phase==='complete'?'大陆已统一':'当前目标：'+c.level}`;
 const box=$('coopMap');box.replaceChildren();
 for(const r of CAMPAIGN_REGIONS){const owned=c.map.owned.includes(r.id),available=c.map.available.includes(r.id),selected=c.map.target===r.id,b=document.createElement('button');
  b.className='conquest-region'+(owned?' owned':'')+(available?' available':'')+(selected?' selected':'');
  b.style.left=Math.max(3,Math.min(97,r.x/7))+'%';b.style.top=(8+r.y*.17)+'%';
  b.textContent=r.castle?'♜':r.id;b.setAttribute('aria-label',r.name+' · '+(r.castle?'城堡':'野战')+' · '+(owned?'盟军领土':available?'可进攻':'未接壤'));
  b.setAttribute('aria-pressed',String(selected));b.title=b.getAttribute('aria-label');b.disabled=!enabled||c.phase!=='shop'||!available;
  b.onclick=()=>command('target',r.id);box.append(b);
 }
 const select=document.createElement('select');select.setAttribute('aria-label','选择共同进攻的地区');select.disabled=!enabled||c.phase!=='shop';
 for(const r of CAMPAIGN_REGIONS.filter(r=>c.map.available.includes(r.id))){const o=document.createElement('option');o.value=r.id;o.textContent=r.name+' · '+(r.castle?'攻城':'野战');select.append(o);}
 select.value=c.map.target;select.onchange=()=>command('target',Number(select.value));
 const old=$('coopTargetSelect');if(old)old.remove();select.id='coopTargetSelect';panel.append(select);
}
function openShop(){if(!state||!seat||state.campaign.phase!=='shop')return;ArmyShop.open({solo:SOLO,onBack:SOLO?soloHome:undefined,title:SOLO?'单人无尽 · 整备完成即可出战':'合作军备 · 购买由房间确认 · 返回后准备出战',ownerLabel:SOLO?'你':`玩家 ${seat.owner+1}`,foreignUnlocked:state.campaign.mode!=='endless'||state.campaign.wave>=15,armies:[state.campaign.armies[seat.owner]],enabled:[true],onAction:command,onReady:()=>command('ready',true)});}
function canSpecial(){if(!seat||!state?.players[seat.owner])return false;const type=state.players[seat.owner][0];return P.has(state.campaign.armies[seat.owner].upgrades,type,C.units[type].specialUpgrade);}
function updateControls(){const p=state.players[seat.owner];if(!p)return;const a=state.campaign.armies[seat.owner],key=a.race+':'+a.roster.join(',')+':'+seat.owner;
 if(key!==cardsKey){cardsKey=key;$('myArmyTitle').textContent=`${SOLO?'':'玩家 '+(seat.owner+1)+' · '}${names[a.race]}`;document.querySelector('.coop-stage').style.setProperty('--left-info-y',(32+Math.ceil(a.roster.length/5)*52)+'px');$('myCards').replaceChildren();for(const id of a.roster){const b=document.createElement('button'),im=new Image(),meter=document.createElement('i');b.className='unit-card';b.dataset.type=id;b.setAttribute('aria-label','选择 '+C.units[id].name);b.title=C.units[id].name+' · '+(C.units[id].charge/24).toFixed(1)+' 秒';im.className='icon';PersianArt.portrait(im,Progression.unitRace(a,id),id);im.src=`assets/icon-${Progression.unitRace(a,id)}-${id}.png`;im.alt='';meter.className='meter';b.append(meter,im);b.onclick=()=>{command('select',id);canvas.focus({preventScroll:true});};$('myCards').append(b);}}
 const d=C.units[p[0]],special=canSpecial(),need=d.charge*(p[4]&&special?2:1),enabled=state.status==='playing'&&loadedRound===state.round;
 $('mySelected').textContent=d.name;$('coopLaneText').textContent=`第 ${p[1]+1} 路`;const buddy=state.players[1-seat.owner],buddyArmy=state.campaign.armies[1-seat.owner];$('buddyName').textContent='盟军 · '+names[buddyArmy.race];$('buddyState').textContent=buddy?`${C.units[buddy[0]].name} · 第 ${buddy[1]+1} 路`:'等待队友';$('myCharge').textContent=p[2]>=need?special&&p[2]>=d.charge*2?'特殊部队就绪':'部队就绪':`充能还需 ${((need-p[2])/24).toFixed(1)} 秒`;$('chargeMeter').value=Math.min(1,p[2]/need);$('coopSend').disabled=!enabled||p[2]<need;$('touchCoopSend').disabled=$('coopSend').disabled;$('coopSpecial').checked=p[4];$('coopSpecial').disabled=!enabled||!special;$('coopAuto').checked=p[3];$('coopAuto').disabled=!enabled;$('coopRally').textContent=p[5]>=C.rallyKillsRequired?'整排 [Q]':'Q '+(p[5]||0)+'/'+C.rallyKillsRequired;$('coopRally').disabled=!enabled||p[2]<need||p[5]<C.rallyKillsRequired;$('coopRally').classList.toggle('rally-ready',p[5]>=C.rallyKillsRequired);$('coopRally').title=p[5]>=C.rallyKillsRequired?(p[2]>=need?'当前兵种八路各出一名':'击杀已满，等待当前兵种出兵冷却'):'个人击杀 '+C.rallyKillsRequired+' 个敌人后解锁整排出兵';$('touchCoopRally').textContent=$('coopRally').textContent;$('touchCoopRally').disabled=$('coopRally').disabled;
 for(const b of $('myCards').children){const id=+b.dataset.type,charge=C.units[id].charge;b.classList.toggle('active',id===p[0]);b.classList.toggle('ready',p[2]>=charge);b.classList.toggle('promoted',P.has(a.upgrades,id,C.units[id].specialUpgrade)&&p[2]>=charge*2);b.setAttribute('aria-pressed',String(id===p[0]));b.style.setProperty('--charge',Math.min(100,p[2]/charge*100)+'%');b.disabled=!enabled;}for(const b of $('laneButtons').children){b.classList.toggle('active',+b.dataset.lane===p[1]);b.disabled=!enabled;}
}
function updateBattleNotice(m=state){
 if(!m||m.campaign.phase!=='battle')return;
 const failed=loadFailedRound===m.round,ready=loadedRound===m.round;
 $('battleNotice').hidden=m.status==='playing'&&ready;
 $('noticeResume').hidden=!m.manualPause||!(m.campaign.solo?m.connected[0]:m.connected.every(Boolean))||m.status==='ended';
 $('reloadAssets').hidden=!failed||m.status==='ended';
 const status=m.status==='ended'?'房间已结束':m.status==='waiting'?'队友暂时离线，等待重连':m.manualPause?'战斗已暂停':failed?'素材载入失败：'+loadError+'\n请点击下方按钮重试（已下载素材会保留）':ready?'本机已就绪，等待队友载入素材…':'正在载入战场素材… '+loadProgress;
 $('battleNoticeText').textContent=status+(SOLO?'':'\n玩家 1 '+(m.loaded[0]?'已就绪':'载入中')+' · 玩家 2 '+(m.loaded[1]?'已就绪':'载入中'));
}
// Keep the retry control inside the visible battlefield overlay, including fullscreen.
$('battleNoticeText').parentElement.append($('reloadAssets'));
$('reloadAssets').style.cssText='position:static;transform:none;max-width:100%';
async function loadRound(m){const generation=++loadGeneration,round=m.round,config=m.battleConfig;loadTask=true;loadFailedRound=-1;loadProgress='';loadError='';$('reloadAssets').hidden=true;
 try{if(config.rosters.some(r=>r.includes(105)))await NativeSpecialVisual.ready;const files=[...RestorationVisual.files(C),config.terrain+'.jpg','arrow-blue.png','arrow-red.png',...(config.rosters.some(roster=>roster.some(id=>C.units[id].caster||C.units[id].projectile==='bolt'))?Object.values(C.magicAtlas).flatMap(x=>x.files):[])];for(let i=0;i<config.races.length;i++){const race=config.races[i];for(const id of new Set([...config.rosters[i],...(config.retiredRosters?.[i]||[])])){const skin=Progression.unitRace({race,mercenaries:config.mercenaries===true&&i<2},id);files.push(...C.atlas[skin+'-'+id].files,...C.effects[skin].files);if(C.nativeWeaponKnock?.[skin+'-'+id])files.push(...C.nativeWeaponKnock[skin+'-'+id].files);if([4,6].includes(id)){const foot=id===4?0:5;files.push(...C.atlas[skin+'-'+foot].files,...C.finishedAtlas[skin+'-'+foot].files);}if(C.finishedAtlas[skin+'-'+id])files.push(...C.finishedAtlas[skin+'-'+id].files);}files.push(...C.effects[race].files);}for(const roster of config.rosters)for(const id of roster){const m=C.projectileAtlas[C.units[id].projectile];if(m)files.push(...m.files);}if(config.siege){const defender=config.races[config.teams.indexOf(config.siege.side)];files.push(...C.atlas[defender+'-castle'].files);for(const race of config.races.slice(0,2))for(const kind of ['climb','ladder','enter'])files.push(...C.atlas[race+'-'+kind].files);}
 const keep=new Set(files);for(const file of images.keys())if(!keep.has(file))images.delete(file);
  await GameAssets.batch([...keep],async file=>{if(images.has(file))return;const im=await GameAssets.image('assets/'+(atlasFiles.has(file)&&!file.startsWith('persian-')?'mobile/':'')+file);if(generation===loadGeneration)images.set(file,im);},(done,total)=>{if(generation===loadGeneration){loadProgress=done+' / '+total;updateBattleNotice();}});
  if(generation!==loadGeneration||state?.round!==round)return;loadedRound=round;updateBattleNotice();send({type:'loaded',round});
 }catch(e){if(generation===loadGeneration){loadFailedRound=round;loadError=e.message;updateBattleNotice();message('素材载入失败：'+e.message+'。点击重试；房间会等你加载完成。');$('reloadAssets').hidden=false;}}
 finally{if(generation===loadGeneration)loadTask=null;}
}
function sprite(m,x,y,sx,sy,dir,frame,alpha=1){if(!m)return;const r=m.frameRects[Math.max(0,Math.min(m.frames-1,frame-1))];let im=images.get(m.files[r.page]);if(!im)return;if(m.persianSkin)im=PersianArt.palette(im);const ts=m.fullResolution?1:scale;ctx.save();ctx.translate(x,y);ctx.scale(dir*sx,sy);ctx.globalAlpha=alpha;if(m.runtimeShadow){ctx.fillStyle="rgba(30,38,29,.23)";ctx.beginPath();ctx.ellipse(0,0,(m.shadowWidth||r.dw*.27),7,0,0,Math.PI*2);ctx.fill();}if(m.healingGlow){ctx.drawImage(NativeSpecialVisual.healFrame(im,r,ts),r.ox,r.oy,r.dw||r.w,r.dh||r.h);}else if(m.fullResolution){const source=PersianArt.frame(im,r);ctx.drawImage(source,r.ox,r.oy,r.dw,r.dh);}else ctx.drawImage(im,r.x*ts,r.y*ts,r.w*ts,r.h*ts,r.ox,r.oy,r.dw||r.w,r.dh||r.h);ctx.restore();}
// Packets are immutable: prepare lane order and ID lookup once per snapshot.
const renderIndexes=new WeakMap();
function renderIndex(packet){
 let index=renderIndexes.get(packet);if(index)return index;
 index={lanes:Array.from({length:8},()=>[]),arrows:Array.from({length:8},()=>[]),supported:Array.from({length:8},()=>[false,false]),unitsById:new Map()};
 for(const u of packet.units){index.lanes[u[3]].push(u);index.unitsById.set(u[0],u);if(u[2]===100&&!u[21]&&!u[7]&&!u[13]&&!u[14])index.supported[u[3]][u[1]]=true;}
 for(const lane of index.lanes)lane.sort((a,b)=>b[7]-a[7]||a[0]-b[0]);
 for(const p of packet.arrows)index.arrows[p[2]].push(p);
 renderIndexes.set(packet,index);return index;
}
let lastDrawAt=-Infinity;
function render(now){requestAnimationFrame(render);if(!seat||!state||state.campaign.phase!=='battle'||loadedRound!==state.round)return;
 const elapsed=now-lastDrawAt;if(elapsed<1000/60-.1)return;lastDrawAt=Number.isFinite(elapsed)?now-elapsed%(1000/60):now;
 const current=renderIndex(state);
 ctx.setTransform(2,0,0,2,0,0);const bg=images.get(state.battleConfig.terrain+'.jpg');if(bg)ctx.drawImage(bg,0,0,stageWidth,500);else ctx.clearRect(0,0,stageWidth,500);
 const ratio=state.status==='playing'&&previous?Math.min(1,(now-receivedAt)/Math.max(1,(state.tick-previous.tick)*1000/24)):1,oldUnits=previous?renderIndex(previous).unitsById:new Map();
 for(let lane=0;lane<8;lane++){const row=L.lanes[lane];const supported=current.supported[lane];for(const side of [0,1])if(supported[side])BannerVisual.lane(ctx,row.y,stageWidth,side);if(state.siege){const race=state.races[state.battleConfig.teams.indexOf(state.siege.side)];sprite(C.atlas[race+'-castle'],screenX(L.worldX(1400,lane)),row.y,4*row.sx,4*row.sy,-1,1);if(state.siege.ladders[lane])sprite(C.atlas[state.races[0]+'-ladder'],screenX(L.worldX(1150,lane)),row.y,2*row.sx,2*row.sy,1,1);}
 RestorationVisual.fx(ctx,state.effects,lane,row,(x,lane)=>screenX(L.worldX(x,lane)),sprite);
 for(const u of current.lanes[lane]){const unitY=row.y-(state.tick<(u[22]?.liftUntil||0)?Math.sin((38-(u[22].liftUntil-state.tick))/38*Math.PI)*90*row.sy:0)+(state.tick<(u[22]?.fallUntil||0)?(24-(u[22].fallUntil-state.tick))*4*row.sy:0);const old=oldUnits.get(u[0]),x=old?old[4]+(u[4]-old[4])*ratio:u[4],race=u[22]?.race||Progression.unitRace({race:state.races[u[11]],mercenaries:state.battleConfig.mercenaries===true&&u[11]<2},u[2]),unitX=screenX(L.worldX(x,lane));if(u[20]&&C.finishedAtlas[race+'-'+u[2]]){RestorationVisual.finish(ctx,{...u[22],race,type:u[2],finishedFrame:u[20],dir:u[1]===0?1:-1},unitX,unitY,2*row.sx,2*row.sy,sprite);continue;}if(u[11]<2&&!u[7]){ctx.fillStyle=COLORS[u[11]];ctx.globalAlpha=.65;ctx.beginPath();ctx.ellipse(unitX,unitY+1,9*row.sx/.12,2,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}if(supported[u[1]]&&!u[7]&&!u[13]&&!u[14])BannerVisual.inspired(ctx,unitX,unitY,2*row.sx,2*row.sy,u[1],state.tick,u[0]);if(u[2]===100&&!u[13]&&!u[14])BannerVisual.standard(ctx,unitX,unitY,2*row.sx,2*row.sy,u[1]===0?1:-1,u[5],!!(u[7]||u[9]));if(!u[13]&&!u[14])NativeSpecialVisual.behind(ctx,race,u[2],u[5],unitX,unitY,2*row.sx,2*row.sy,u[1]===0?1:-1,!!u[7],!!u[9],u[7]?Math.max(0,Math.min(1,(224-u[8])/35)):1);sprite(u[9]&&!PersianArt.knockFrame(race,u[2])?(C.nativeWeaponKnock?.[race+'-'+u[2]]||C.effects[race]):C.atlas[race+'-'+(u[13]?'climb':u[14]?'enter':u[2])],unitX,unitY,2*row.sx,2*row.sy,u[1]===0?1:-1,u[15]||u[9]&&PersianArt.knockFrame(race,u[2])?(u[15]?C.units[u[2]].labels.die1:PersianArt.knockFrame(race,u[2])):u[9]||u[13]||u[14]||u[5],u[7]?Math.max(0,Math.min(1,(224-u[8])/35)):1);if(!u[13]&&!u[14]){NativeSpecialVisual.props(ctx,race,u[2],u[5],unitX,unitY,2*row.sx,2*row.sy,u[1]===0?1:-1,!!u[7],!!u[9],u[7]?Math.max(0,Math.min(1,(224-u[8])/35)):1);if(!u[7]&&!u[9])NativeSpecialVisual.status(ctx,unitX,unitY,2*row.sx,2*row.sy,state.tick,u[18]||0,u[19]||0);}NativeReinforcementVisual.status(ctx,{...u[22],x:u[4],dead:!!u[7],finishing:!!u[21]},unitX,unitY,2*row.sx,2*row.sy,state.tick);RestorationVisual.status(ctx,{...u[22],dead:!!u[7],finishing:!!u[21]},unitX,unitY,2*row.sx,2*row.sy,state.tick,sprite);PersianArt.status(ctx,unitX,unitY,2*row.sx,u[15],u[16]);PersianArt.vitals(ctx,unitX,unitY,u[6],u[17]||C.units[u[2]].health,u[2]);}
  for(const p of current.arrows[lane]){if(p[8]==='heal'){NativeSpecialVisual.healOrb(ctx,screenX(L.worldX(p[3],lane)),row.y+p[4]*row.sy,2*row.sx,p[5]*row.sx,p[6]*row.sy,p[9]);continue;}if(p[8]!=='arrow'){const x=screenX(L.worldX(p[3],lane)),y=row.y+p[4]*row.sy;if(C.magicAtlas[p[8]])sprite(C.magicAtlas[p[8]],x,y,2*row.sx,2*row.sy,p[10],p[9]);else SiegeVisual.draw(ctx,{visual:p[8],vx:p[5],vy:p[6],age:p[9],frame:['fire','obelisk'].includes(p[8])?p[9]:undefined,dir:p[10],rotation:p[11],alpha:p[12]},x,y,2*row.sx,2*row.sy,sprite);continue;}ctx.save();ctx.translate(screenX(L.worldX(p[3],lane)),row.y+p[4]*row.sy);ctx.rotate(Math.atan2(p[6]*row.sy,p[5]*row.sx));ctx.scale(row.sx*2,row.sy*2);ctx.strokeStyle='#493b26';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(12,0);ctx.stroke();ctx.restore();}
 }
 for(let i=0;i<(state.campaign.solo?1:2);i++){const p=state.players[i],row=L.lanes[p[1]],im=images.get(p[5]>=C.rallyKillsRequired?'arrow-red.png':'arrow-blue.png'),x=screenX(row.x-row.halfWidth)-(i===1?13:0);if(im){ctx.save();ctx.globalAlpha=i===seat.owner?1:.65;ctx.drawImage(im,x-29.5,row.y-19+(i===1?6:0),83,42);ctx.restore();}ctx.fillStyle=COLORS[i];ctx.font='bold 11px sans-serif';ctx.fillText('P'+(i+1),x-30,row.y-22+(i===1?7:0));}
}
for(const [id,r]of Object.entries(C.races)){const o=document.createElement('option');o.value=id;o.textContent=r.name;$('coopRace').append(o);}
for(let i=0;i<8;i++){const b=document.createElement('button');b.textContent=(i+1)+' 路';b.dataset.lane=i;b.onclick=()=>command('lane',i);$('laneButtons').append(b);}
if(SOLO){$('battleRoomBack').textContent='主菜单';canvas.setAttribute('aria-label','单人八路战场，W S 选路，A D 选兵，空格出兵');document.title='种族战役2 · 单人无尽';document.querySelector('.page-header small').textContent='种族战役 II · 单人无尽';document.querySelector('#shopPhase > .muted').textContent='整备完成后开始；补给期间完成整备即可继续原战场。';document.querySelector('.page-header h1').textContent='单人无尽守卫';$('lobby').querySelector('h2').textContent='独自迎战，守住防线';$('lobby').querySelector('p').textContent='敌军出兵数量减半，波次节奏与双人一致；每10波补给，第15波开放跨族外援。';$('lobby').querySelector('.muted').textContent='初始3000黄金，无需等待队友。补给商店由你自行决定进入或跳过。';$('coopMode').value='endless';$('coopMode').parentElement.hidden=true;$('joinRoom').closest('details').hidden=true;$('createRoom').textContent='开始单人无尽';$('connection').textContent='正在准备单人无尽军备…';$('backLobby').textContent='返回主菜单';}
$('supplyYes').onclick=()=>command('shopVote',true);$('supplySkip').onclick=()=>command('shopVote',false);
$('coopRace').parentElement.hidden=true;$('matchRoom').hidden=SOLO;$('lobby').querySelector('.muted').textContent=SOLO?'初始3000黄金，敌军数量减半。':'创建后在当前页面等待；加入会匹配相同模式的等候房间，匹配后双方各自选种族。';$('lobby').querySelector('details').hidden=true;
$('createRoom').onclick=()=>{if(connecting)return;if(SOLO)RacePicker.open({confirmLabel:'开始无尽',note:'初始3000黄金 · 单人敌军数量减半',onConfirm:race=>{connect({type:'create',race,mode:'soloEndless'});return true;}});else connect({type:'create',race:'human',mode:$('coopMode').value,chooseRace:true});};$('matchRoom').onclick=()=>{if(!connecting)connect({type:'auto',race:'human',mode:$('coopMode').value,chooseRace:true,joinOnly:true});};
$('joinRoom').onclick=()=>{const room=$('joinCode').value.trim().toUpperCase();if(!/^[A-F0-9]{8}$/.test(room))return message('请输入完整的 8 位房间码。');if(!connecting)connect({type:'join',race:$('coopRace').value,room});};
$('openShop').onclick=openShop;$('readyRoom').onclick=()=>command('ready',!state.campaign.ready[seat.owner]);$('retryRoom').onclick=()=>command('retry');$('pauseRoom').onclick=()=>command('pause',!state.manualPause);
$('coopRally').onclick=$('touchCoopRally').onclick=()=>command('rally');
$('coopSend').onclick=()=>command('send');$('touchCoopSend').onclick=()=>command('send');$('touchCoopPause').onclick=()=>command('pause',!state.manualPause);$('noticeResume').onclick=()=>command('pause',false);$('battleRoomBack').onclick=()=>{if(SOLO){soloHome();return;}command('pause',true);document.querySelector('.coop-shell').classList.toggle('show-room');};$('coopAuto').onchange=()=>{command('auto',$('coopAuto').checked);canvas.focus({preventScroll:true});};$('coopSpecial').onchange=()=>{command('special',$('coopSpecial').checked);canvas.focus({preventScroll:true});};
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
document.addEventListener('keydown',e=>{if(!seat||state?.campaign.phase!=='battle'||ArmyShop.isOpen()||document.querySelector('dialog[open]')||/^(INPUT|SELECT)$/.test(e.target.tagName))return;const p=state.players[seat.owner],list=state.campaign.armies[seat.owner].roster,keys={KeyW:['lane',Math.max(0,p[1]-1)],ArrowUp:['lane',Math.max(0,p[1]-1)],KeyS:['lane',Math.min(7,p[1]+1)],ArrowDown:['lane',Math.min(7,p[1]+1)],KeyA:['select',list[(list.indexOf(p[0])-1+list.length)%list.length]],ArrowLeft:['select',list[(list.indexOf(p[0])-1+list.length)%list.length]],KeyD:['select',list[(list.indexOf(p[0])+1)%list.length]],ArrowRight:['select',list[(list.indexOf(p[0])+1)%list.length]],Space:['send'],Enter:['send'],KeyQ:['rally'],KeyE:['special',!p[4]],KeyP:['pause',!state.manualPause]};if(keys[e.code]){e.preventDefault();if(!e.repeat)command(...keys[e.code]);}});
const invite=new URLSearchParams(location.search).get('room');if(invite)$('joinCode').value=invite;
const entry=new URLSearchParams(location.search),fresh=SOLO&&entry.get('new')==='1';
try{const saved=fresh?null:JSON.parse(sessionStorage.getItem(SESSION)||'null');if(fresh){seat=null;saveSeat();}if(saved&&Number.isInteger(saved.owner)&&saved.token&&saved.room){seat=saved;connect({type:'resume',room:saved.room,token:saved.token});}else if(SOLO){const race=entry.get('race');if(Object.hasOwn(C.races,race))connect({type:'create',race,mode:'soloEndless'});else soloChoose();}}catch{if(SOLO)soloChoose();}

requestAnimationFrame(render);
})();

(function(){
'use strict';
const $=id=>document.getElementById(id),{Battle,ORDER,FPS}=Warlords,C=CONTENT,canvas=$('canvas'),ctx=canvas.getContext('2d');
const images={},SAVE='warlords2-remake-battle-v1';
const mobileAssets=matchMedia('(max-width:900px),(pointer:coarse)').matches,textureScale=mobileAssets ? 0.5 : 1;
const atlasFiles=new Set([...Object.values(C.atlas),...Object.values(C.effects),...Object.values(C.magicAtlas),...Object.values(C.projectileAtlas||{})].flatMap(m=>m.files));
let sim=null,paused=false,soundOn=false,last=0,acc=0,lastUi=-1,assetsReady=false,toastTimer,wasHelpPaused=false;
const L=BATTLE_LAYOUT,laneY=i=>L.lanes[i].y;
const landscape=matchMedia('(max-height:600px) and (orientation:landscape) and (max-width:1100px)');
let stageWidth=700;
const screenX=x=>x*stageWidth/700,worldX=(x,lane)=>screenX(L.worldX(x,lane));
function resize(){
 const r=$('viewport').getBoundingClientRect();if(!r.width||!r.height)return;
 const wide=landscape.matches&&$('shell').classList.contains('playing'),zoom=wide?r.height/500:r.width/700;
 stageWidth=wide?r.width/zoom:700;$('stage').style.width=stageWidth+'px';$('stage').style.setProperty('--stage-scale',zoom);
 canvas.style.width=stageWidth+'px';const width=Math.round(stageWidth*2);if(canvas.width!==width)canvas.width=width;
 if(sim&&!$('battle').hidden)render();
}
landscape.addEventListener('change',resize);
new ResizeObserver(resize).observe($('viewport'));resize();
const P=Progression,ARMY_SAVE='warlords2-armies-v1';let armyConfigs={};try{armyConfigs=JSON.parse(localStorage.getItem(ARMY_SAVE)||'{}');}catch{}if(!armyConfigs||typeof armyConfigs!=='object'||Array.isArray(armyConfigs))armyConfigs={};
function armyConfig(side,race){const key=side+':'+race;let cfg=armyConfigs[key];if(!cfg||!P.validateArmy(cfg.army)||cfg.army.race!==race)cfg=armyConfigs[key]={enabled:false,army:P.createArmy(race,3000)};return cfg;}
function saveArmies(){try{localStorage.setItem(ARMY_SAVE,JSON.stringify(armyConfigs));}catch{toast('军备未能保存到浏览器。');}}
const names=Object.fromEntries(Object.entries(C.races).map(([id,r])=>[id,r.name]));
let loading=false,menuDrawId=0,audioCtx=null;const soundBuffers={};
const storage={get(){try{return localStorage.getItem(SAVE);}catch{return null;}},set(v){try{localStorage.setItem(SAVE,v);return true;}catch{return false;}}};
function toast(s){$('toast').textContent=s;$('toast').style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity='0',2800);}
function play(key){if(!soundOn||!audioCtx||audioCtx.state!=='running'||!soundBuffers[key])return;const src=audioCtx.createBufferSource(),gain=audioCtx.createGain();src.buffer=soundBuffers[key];gain.gain.value=.18;src.connect(gain).connect(audioCtx.destination);src.onended=()=>{src.disconnect();gain.disconnect();};src.start();}
async function unlockSound(){try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();await Promise.all(Object.entries(C.sounds).map(async([key,file])=>{if(!soundBuffers[key])soundBuffers[key]=await audioCtx.decodeAudioData(await (await fetch('assets/'+file)).arrayBuffer());}));if(soundOn)play('spear');}catch{toast('声音暂时不可用，可以再次点击声音按钮。');}}
async function ensureImages(files,progress){await GameAssets.batch(files,async file=>{if(!images[file])images[file]=await GameAssets.image('assets/'+(mobileAssets&&atlasFiles.has(file)&&!file.startsWith('persian-')?'mobile/':'')+file);},progress);}
async function prepareBattle(b){
 if(b.options.mode==='duel'){toast('双人对战已移除，请从主菜单进入双人合作。');return false;}
 if(loading)return false;loading=true;const previousPaused=paused;paused=true;$('loadingLayer').hidden=false;$('loadingText').textContent='正在载入双方军队…';
 try{if(b.options.rosters.some(r=>r.includes(105)))await NativeSpecialVisual.ready;const files=[...RestorationVisual.files(C),b.options.terrain+'.jpg','arrow-blue.png','arrow-red.png',...(b.options.rosters.some(roster=>roster.some(id=>C.units[id].caster||C.units[id].projectile==='bolt'))?Object.values(C.magicAtlas).flatMap(m=>m.files):[])];
  for(const [side,race]of b.options.races.entries()){for(const id of b.roster(side)){files.push(...C.atlas[race+'-'+id].files,`icon-${race}-${id}.png`);if(C.nativeWeaponKnock?.[race+'-'+id])files.push(...C.nativeWeaponKnock[race+'-'+id].files);if([4,6].includes(id)){const foot=id===4?0:5;files.push(...C.atlas[race+'-'+foot].files,...C.finishedAtlas[race+'-'+foot].files);}}if(C.effects[race])files.push(...C.effects[race].files);for(const id of b.roster(side))if(C.finishedAtlas[race+'-'+id])files.push(...C.finishedAtlas[race+'-'+id].files);}
  for(const roster of b.options.rosters)for(const id of roster){const m=C.projectileAtlas[C.units[id].projectile];if(m)files.push(...m.files);}
  if(b.siege){files.push(...C.atlas[b.options.races[b.siege.side]+'-castle'].files);for(const race of b.options.races)for(const kind of ['climb','ladder','enter'])files.push(...C.atlas[race+'-'+kind].files);}
  const keep=new Set(files);for(const file of Object.keys(images))if(!keep.has(file))delete images[file];
  await ensureImages(files,(done,total)=>{$('loadingText').textContent=`正在载入双方军队… ${done} / ${total}\n首次下载稍慢，后续会使用缓存`;});sim=b;openBattle();return true;
 }catch(e){paused=previousPaused;toast('军队素材读取失败：'+e.message);return false;}
 finally{loading=false;$('loadingLayer').hidden=true;}
}

function save(notify=true){if(!sim||sim.options.preview)return;if(globalThis.CampaignUI?.saveBattle(sim)){if(notify)toast('战役与当前战斗已保存。');return;}const ok=storage.set(JSON.stringify(sim.snapshot()));$('continueBtn').disabled=!ok;if(notify)toast(ok?'战斗已保存，可从主菜单继续。':'浏览器未允许本地存储，请在暂停菜单导出存档。');}
function drawUnit(target,u,x,y,scale=.49,frame=u.frame,scaleY=scale){
 if(u.finishedFrame&&C.finishedAtlas[u.race+'-'+u.type]){RestorationVisual.finish(target,u,x,y,scale,scaleY,(...args)=>drawSprite(target,...args));return;}
 if(u.liftUntil>sim?.tick)y-=Math.sin(Math.PI*(1-(u.liftUntil-sim.tick)/38))*45*scaleY;
 if(u.fallUntil>sim?.tick)y+=(24-(u.fallUntil-sim.tick))*2*scaleY;
 if(u.type===100&&!u.climbFrame&&!u.enterFrame)BannerVisual.standard(target,x,y,scale,scaleY,u.dir,frame,!!(u.dead||u.knockFrame));
 const pose=u.climbFrame?'climb':u.enterFrame?'enter':u.type,m=u.knockFrame&&!PersianArt.knockFrame(u.race,u.type)?(C.nativeWeaponKnock?.[u.race+'-'+u.type]||C.effects[u.race]):C.atlas[u.race+'-'+pose];if(!m)return;frame=u.downedTicks||u.knockFrame&&PersianArt.knockFrame(u.race,u.type)?(u.downedTicks?C.units[u.type].labels.die1:PersianArt.knockFrame(u.race,u.type)):u.knockFrame||u.climbFrame||u.enterFrame||frame;if(globalThis.NativeSpecialVisual&&!u.climbFrame&&!u.enterFrame)NativeSpecialVisual.behind(target,u.race,u.type,frame,x,y,scale,scaleY,u.dir,u.dead,!!u.knockFrame,u.dead?Math.max(0,Math.min(1,(224-u.ageDead)/35)):1);drawSprite(target,m,x,y,scale,scaleY,u.dir,frame,u.dead?Math.min(1,(224-u.ageDead)/35):1);if(globalThis.NativeSpecialVisual&&!u.climbFrame&&!u.enterFrame){NativeSpecialVisual.props(target,u.race,u.type,frame,x,y,scale,scaleY,u.dir,u.dead,!!u.knockFrame,u.dead?Math.max(0,Math.min(1,(224-u.ageDead)/35)):1);if(!u.dead&&!u.knockFrame)NativeSpecialVisual.status(target,x,y,scale,scaleY,sim?.tick||0,u.healPulseUntil||0,u.slowUntil||0);}if(sim){RestorationVisual.status(target,u,x,y,scale,scaleY,sim.tick,(...args)=>drawSprite(target,...args));NativeReinforcementVisual.status(target,u,x,y,scale,scaleY,sim.tick);}PersianArt.status(target,x,y,scale,u.downedTicks,u.reviveUsed);PersianArt.vitals(target,x,y,u.hp,u.maxHp,u.type);
}
function drawSprite(target,m,x,y,scale,scaleY,dir,frame,alpha=1){
 const f=Math.max(0,Math.min(m.frames-1,frame-1));
 const r=m.frameRects[f];let im=images[m.files[r.page]];if(!im)return;if(m.persianSkin)im=PersianArt.palette(im);const ts=m.fullResolution?1:textureScale;
 target.save();target.translate(x,y);target.scale(dir*scale,scaleY);target.globalAlpha=alpha;if(m.runtimeShadow){target.fillStyle="rgba(30,38,29,.23)";target.beginPath();target.ellipse(0,0,(m.shadowWidth||r.dw*.27),7,0,0,Math.PI*2);target.fill();}
 if(m.healingGlow){target.drawImage(NativeSpecialVisual.healFrame(im,r,ts),r.ox,r.oy,r.dw||r.w,r.dh||r.h);}else if(m.fullResolution){const source=PersianArt.frame(im,r);target.drawImage(source,r.ox,r.oy,r.dw,r.dh);}else target.drawImage(im,r.x*ts,r.y*ts,r.w*ts,r.h*ts,r.ox,r.oy,r.dw||r.w,r.dh||r.h);target.restore();
}
function buildCards(){
 for(const side of [0,1]){const group=$(side===0?'units':'enemyUnits');group.replaceChildren();
  for(const type of sim.roster(side)){const d=C.units[type],b=document.createElement('button');b.className='unit-card';b.dataset.type=type;b.setAttribute('aria-label',(side===0?'玩家一 ':'玩家二 ')+d.name);b.title=`${d.name} · 生命 ${d.health} · ${(d.charge/24).toFixed(1)} 秒`;b.disabled=sim.options.mode==='watch'||(side===1&&sim.options.mode!=='duel');b.innerHTML='<i class="meter"></i><img class="icon" alt="">';PersianArt.portrait(b.querySelector('img'),sim.options.races[side],type);b.querySelector('img').src=`assets/icon-${sim.options.races[side]}-${type}.png`;b.onclick=()=>{command(side,'select',type);canvas.focus({preventScroll:true});};group.append(b);}
  $('battle').style.setProperty(side===0?'--left-info-y':'--right-info-y',(32+Math.ceil(sim.roster(side).length/5)*52)+'px');
 }
}
async function drawMenu(){
 const ticket=++menuDrawId,race=$('race').value,opponent=$('enemyRace').value;
 $('selectionSummary').textContent=names[race]+' 对 '+names[opponent]+' · '+$('terrain').selectedOptions[0].textContent;
 try{await ensureImages([...C.atlas[race+'-1'].files,...C.atlas[opponent+'-2'].files]);if(ticket!==menuDrawId)return;const c=$('menuArt').getContext('2d');c.clearRect(0,0,700,500);drawUnit(c,{race,type:1,dir:1},61.2,339.8,1.621872,1);drawUnit(c,{race:opponent,type:2,dir:-1},621.2,339.8,1.621872,1);}catch(e){toast('预览资源读取失败：'+e.message);}
}
async function start(mode){
 if(!assetsReady){toast('原画资源仍在加载，请稍候。');return;}
 const races=[$('race').value,$('enemyRace').value],configs=races.map((race,side)=>armyConfig(side,race));
 const rosters=configs.map((cfg,i)=>cfg.enabled?cfg.army.roster:C.races[races[i]].roster.slice(0,10));
 const upgrades=configs.map((cfg,i)=>cfg.enabled?cfg.army.upgrades:Object.fromEntries(rosters[i].filter(id=>C.units[id].caster&&P.eligible(races[i],id,17)).map(id=>[id,[17]])));
 const b=new Battle({seed:Math.floor(Date.now()%4294967295),mode,races,rosters,upgrades,terrain:$('terrain').value});await prepareBattle(b);
}
function openBattle(){
 globalThis.CampaignUI?.hide();$('againBtn').textContent='再战一场';$('exportBtn').textContent=sim.options.campaign?'导出战役存档':'导出战斗存档';
 $('shell').classList.add('playing');
 paused=false;acc=0;last=performance.now();lastUi=-1;$('menu').hidden=true;$('battle').hidden=false;$('pauseLayer').hidden=true;$('resultLayer').hidden=true;$('pauseBtn').textContent='暂停';
 $('race').value=sim.options.races[0];$('enemyRace').value=sim.options.races[1];$('terrain').value=sim.options.terrain;$('leftName').textContent=names[sim.options.races[0]];$('rightName').textContent=names[sim.options.races[1]];
 $('controlsHint').textContent=mobileAssets?'横屏：点头像选兵、点路线出兵；竖屏：使用下方按钮。':sim.options.mode==='duel'?'玩家一：W S / A D / 空格　玩家二：↑↓ / ←→ / Enter':sim.options.mode==='watch'?'电脑自动对战 · P 暂停 · 可保存并继续':'W / S 选路 · A / D 选兵 · 空格出兵 · Q 整排（35 击杀）· P 暂停';
 resize();$('auto').checked=sim.players[0].auto;$('touchAuto').checked=sim.players[0].auto;buildCards();updateUi();render();canvas.focus({preventScroll:true});
}
function command(side,type,value){if(!sim||paused||sim.winner!==null||sim.options.mode==='watch'||(side===1&&sim.options.mode!=='duel'))return false;
 const ok=sim.command(side,type,value);if(type==='send'&&ok)play({0:'spear',1:'sword',2:'archer',5:'halberd'}[sim.players[side].selected]);updateUi();return ok;
}
function setPause(value){if(!sim||sim.winner!==null)return;paused=value;acc=0;$('pauseLayer').hidden=!value||!!sim.options.preview;$('pauseBtn').textContent=value?'继续':'暂停';if(value)save(false);else canvas.focus({preventScroll:true});}
function toMenu(){if(sim&&sim.winner===null)save(false);paused=true;globalThis.CampaignUI?.hide();$('shell').classList.remove('playing');$('battle').hidden=true;$('menu').hidden=false;resize();$('continueBtn').disabled=!storage.get();$('controlsHint').textContent='W / S 选路 · A / D 选兵 · 空格出兵 · Q 整排（35 击杀）· P 暂停';drawMenu();}
function updateUi(){
 if(!sim)return;const p=sim.players[0],d=C.units[p.selected],need=sim.chargeNeeded(0),ready=p.charge>=need;
 $('leftScore').textContent='突破 '+sim.scores[0];$('rightScore').textContent='突破 '+sim.scores[1];
 $('advantage').style.width=Math.max(0,Math.min(100,50+(sim.scores[0]-sim.scores[1])*2))+'%';
 if(sim.siege){$('advantage').style.width=Math.min(100,sim.siege.score/sim.siege.target*100)+'%';$('leftScore').textContent='攻城 '+Math.floor(sim.siege.score)+' / '+sim.siege.target;$('rightScore').textContent='防线 '+Math.max(0,25-sim.scores[sim.siege.side]);}
 const time=Math.max(0,Math.ceil((7200-sim.tick)/24));$('timer').textContent=String(Math.floor(time/60)).padStart(2,'0')+':'+String(time%60).padStart(2,'0');$('sudden').textContent=time===0?'平分加时':'';
 $('laneText').textContent='第 '+(p.lane+1)+' 路';$('chargeText').textContent=ready?(sim.canSpecial(0)?p.charge>=d.charge*2?'特殊部队准备就绪':'普通就绪 · 特殊还需 '+((d.charge*2-p.charge)/24).toFixed(1)+' 秒':'部队准备就绪'):'出兵准备 · '+((need-p.charge)/24).toFixed(1)+' 秒';$('sendBtn').disabled=!ready||sim.options.mode==='watch'||sim.winner!==null;
 $('rallyBtn').textContent=p.rallyKills>=C.rallyKillsRequired?'整排 [Q]':'Q '+p.rallyKills+'/'+C.rallyKillsRequired;$('rallyBtn').disabled=$('sendBtn').disabled||p.rallyKills<C.rallyKillsRequired;$('rallyBtn').classList.toggle('rally-ready',p.rallyKills>=C.rallyKillsRequired);$('rallyBtn').title=p.rallyKills>=C.rallyKillsRequired?(ready?'按 Q：当前兵种八路各出一名':'击杀已满，等待当前兵种出兵冷却'):'击杀 '+C.rallyKillsRequired+' 个敌人后解锁整排出兵';$('touchRally').textContent=$('rallyBtn').textContent;$('touchRally').disabled=$('rallyBtn').disabled;
 $('selectedName').textContent=d.name+(sim.canSpecial(0)&&p.charge>=d.charge*2?' · 特殊就绪':'');$('special').disabled=!sim.canSpecial(0);$('special').checked=p.special;$('touchSpecial').disabled=$('special').disabled;$('touchSpecial').checked=p.special;$('touchSelected').textContent=d.name+' · 第 '+(p.lane+1)+' 路';$('touchCharge').textContent=ready?(sim.canSpecial(0)&&p.charge>=d.charge*2?'特殊就绪':'准备就绪'):((need-p.charge)/24).toFixed(1)+' 秒';$('touchSend').disabled=$('sendBtn').disabled;$('touchAuto').checked=p.auto;$('auto').checked=p.auto;
 const enemy=sim.players[1],ed=C.units[enemy.selected],enemyNeed=sim.chargeNeeded(1);$('enemySelectedName').textContent=ed.name+(sim.canSpecial(1)&&enemy.charge>=ed.charge*2?' · 特殊就绪':'');$('enemyChargeText').textContent=enemy.charge>=enemyNeed?'部队准备就绪':'出兵准备 · '+((enemyNeed-enemy.charge)/24).toFixed(1)+' 秒';
 for(const side of [0,1])for(const b of $(side===0?'units':'enemyUnits').children){const id=Number(b.dataset.type),player=sim.players[side];b.classList.toggle('active',id===player.selected);b.classList.toggle('promoted',sim.canSpecial(side,id)&&player.charge>=C.units[id].charge*2);b.classList.toggle('ready',player.charge>=C.units[id].charge);b.setAttribute('aria-pressed',String(id===player.selected));b.style.setProperty('--charge',Math.min(100,player.charge/C.units[id].charge*100)+'%');}
 if(sim.winner!==null)$('resultBanner').src='assets/'+(sim.winner===0?'victory':'defeat')+'.png';
 if(sim.winner!==null){$('resultLayer').hidden=false;$('pauseLayer').hidden=true;$('resultTitle').textContent=sim.options.mode==='solo'?(sim.winner===0?'胜利':'战败'):names[sim.options.races[sim.winner]]+'获胜';$('resultStats').textContent=`突破 ${sim.scores[0]} : ${sim.scores[1]}　·　战斗 ${Math.floor(sim.tick/24)} 秒\n双方出兵 ${sim.players[0].spawned} / ${sim.players[1].spawned}　·　击杀 ${sim.players[0].kills} / ${sim.players[1].kills}`;}
 if(sim.winner!==null)globalThis.CampaignUI?.onResult(sim);
}
function arrow(side){
 const p=sim.players[side],row=L.lanes[p.lane],ready=p.charge>=sim.chargeNeeded(side);
 const im=images[p.rallyKills>=C.rallyKillsRequired?'arrow-red.png':'arrow-blue.png'];
 const x=row.x+(side===0?-row.halfWidth:row.halfWidth),dir=side===0?1:-1;
 ctx.save();ctx.translate(screenX(x),laneY(p.lane));ctx.scale(dir,1);ctx.globalAlpha=ready?1:Math.max(.15,p.charge/sim.chargeNeeded(side));
 // Arrow 1724 at (12,2), inside selection 1725; its two parent scales cancel.
 if(im)ctx.drawImage(im,-29.5,-19,83,42);ctx.restore();
}
function render(){
 if(!sim)return;
 // Fixed 700 x 500 stage; two backing pixels per stage pixel, uniform CSS scaling.
 ctx.setTransform(2,0,0,2,0,0);
 const bg=images[sim.options.terrain+'.jpg']||images['forest.jpg'];if(bg)ctx.drawImage(bg,0,0,stageWidth,500);else{ctx.fillStyle='#546331';ctx.fillRect(0,0,stageWidth,500);}
 for(let lane=0;lane<8;lane++){
  const row=L.lanes[lane],y=row.y;
  for(const side of [0,1])if(sim.laneSupported(side,lane))BannerVisual.lane(ctx,y,stageWidth,side);
  if(sim.siege){const side=sim.siege.side,race=sim.options.races[side],x=side===1?1400:-1400;drawSprite(ctx,C.atlas[race+'-castle'],worldX(x,lane),y,4*row.sx,4*row.sy,side===1?-1:1,1);if(sim.siege.ladders[lane])drawSprite(ctx,C.atlas[sim.options.races[1-side]+'-ladder'],worldX(side===1?1150:-1150,lane),y,2*row.sx,2*row.sy,side===1?1:-1,1);}
  // Far lanes render first so nearby soldiers correctly overlap them.
  const arr=sim.units.filter(u=>u.lane===lane).sort((a,b)=>Number(b.dead)-Number(a.dead)||a.id-b.id);
  const supported=[sim.laneSupported(0,lane),sim.laneSupported(1,lane)];
  RestorationVisual.fx(ctx,sim.effects,lane,row,worldX,(...args)=>drawSprite(ctx,...args));
  for(const u of arr){if(supported[u.side]&&!u.dead&&!u.finishing&&!u.exited&&!u.climbFrame&&!u.enterFrame)BannerVisual.inspired(ctx,worldX(u.x,lane),y,2*row.sx,2*row.sy,u.side,sim.tick,u.id);drawUnit(ctx,u,worldX(u.x,lane),y,2*row.sx,u.frame,2*row.sy);}
  for(const p of sim.projectiles.filter(p=>p.lane===lane)){
   if(p.kind==='heal'){NativeSpecialVisual.healOrb(ctx,worldX(p.x,lane),y+p.y*row.sy,2*row.sx,p.vx*row.sx,p.vy*row.sy,p.frame);continue;}
   if(p.kind){drawSprite(ctx,C.magicAtlas[p.kind],worldX(p.x,lane),y+p.y*row.sy,2*row.sx,2*row.sy,p.dir,p.frame);continue;}
   if(p.visual){SiegeVisual.draw(ctx,p,worldX(p.x,lane),y+p.y*row.sy,2*row.sx,2*row.sy,(...args)=>drawSprite(ctx,...args));continue;}
   ctx.save();ctx.translate(worldX(p.x,lane),y+p.y*row.sy);ctx.rotate(Math.atan2(p.vy*row.sy,p.vx*row.sx));ctx.scale(row.sx*2,row.sy*2);
   ctx.strokeStyle='#463828';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(10,0);ctx.stroke();ctx.fillStyle='#b7b9a4';ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(8,-3);ctx.lineTo(8,3);ctx.closePath();ctx.fill();ctx.restore();
  }
 }
 if(sim.options.mode!=='watch')arrow(0);if(sim.options.mode==='duel')arrow(1);
}
function loop(now){
 const dt=Math.min((now-last)/1000,.15);last=now;
 if(sim&&!paused&&!$('battle').hidden&&sim.winner===null){acc+=dt;let count=0;while(acc>=1/FPS&&count++<4){sim.step();acc-=1/FPS;for(const e of sim.events){if(e.type==='bow')play('bow');if(e.type==='hit'&&sim.tick%3===0)play('hit');}if(sim.tick%240===0)save(false);}}
 if(sim&&!$('battle').hidden){const finalFrame=sim.winner!==null&&$('resultLayer').hidden;if(!paused&&sim.winner===null||finalFrame)render();if(finalFrame||lastUi!==Math.floor(sim.tick/2)){updateUi();lastUi=Math.floor(sim.tick/2);}}requestAnimationFrame(loop);
}
$('shopBtn').onclick=()=>{const configs=[$('race').value,$('enemyRace').value].map((race,i)=>armyConfig(i,race)),enabled=configs.map(c=>c.enabled);ArmyShop.open({title:'野战军备 · 每方初始 3000 黄金',armies:configs.map(c=>c.army),enabled,onChange(i){configs[i].enabled=true;enabled[i]=true;saveArmies();},onToggle(i){configs[i].enabled=enabled[i];saveArmies();},onReset(i){const a=configs[i].army,r=P.createArmy(a.race,3000);for(const key of Object.keys(a))delete a[key];Object.assign(a,r);saveArmies();}});};
$('special').onchange=()=>{command(0,'special',$('special').checked);canvas.focus({preventScroll:true});};$('touchSpecial').onchange=()=>command(0,'special',$('touchSpecial').checked);
$('soloBtn').onclick=()=>start('solo');$('quickBattle').onclick=()=>start('solo');$('soloEndlessBtn').onclick=()=>{const url=new URL(document.querySelector('.coop-entry').href,location.href);url.searchParams.set('solo','endless');location.href=url.href;};
$('coopBtn').onclick=()=>{location.href=document.querySelector('.coop-entry').href;};$('watchBtn').onclick=()=>start('watch');
$('optionsBtn').onclick=()=>$('options').showModal();$('closeOptions').onclick=()=>$('options').close();$('options').onclose=drawMenu;$('battleHomeBtn').onclick=toMenu;
$('continueBtn').onclick=async()=>{try{const b=Battle.restore(JSON.parse(storage.get()));if(await prepareBattle(b))setPause(true);}catch(e){toast('无法读取存档：'+e.message);}};
$('rallyBtn').onclick=$('touchRally').onclick=()=>{command(0,'rally');canvas.focus({preventScroll:true});};
$('sendBtn').onclick=()=>{command(0,'send');canvas.focus({preventScroll:true});};$('auto').onchange=()=>{command(0,'auto',$('auto').checked);resize();$('auto').checked=sim.players[0].auto;canvas.focus({preventScroll:true});};$('pauseBtn').onclick=()=>setPause(!paused);$('resumeBtn').onclick=()=>setPause(false);$('saveBtn').onclick=()=>save();$('menuBtn').onclick=toMenu;$('resultMenuBtn').onclick=toMenu;$('againBtn').onclick=()=>sim.options.campaign?CampaignUI.continueResult():start(sim.options.mode);
$('soundBtn').onclick=()=>{soundOn=!soundOn;$('soundBtn').textContent='声音：'+(soundOn?'开':'关');$('soundBtn').setAttribute('aria-pressed',String(soundOn));if(soundOn)unlockSound();};
// Fullscreen and Home Screen instructions are shared with the co-op page.
$('helpBtn').onclick=()=>{wasHelpPaused=paused;if(sim&&sim.winner===null)setPause(true);$('help').showModal();};$('closeHelp').onclick=()=>$('help').close();$('help').onclose=()=>{if(!wasHelpPaused&&!$('battle').hidden)setPause(false);};
$('exportBtn').onclick=()=>{if(sim.options.campaign)return CampaignUI.export();const blob=new Blob([JSON.stringify(sim.snapshot())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='种族战役2-战斗存档.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('战斗存档已导出。');};
$('importBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw Error('存档文件过大');const parsed=JSON.parse(await f.text());if(parsed.format==='warlords2-campaign'){await CampaignUI.import(parsed);return;}const restored=Battle.restore(parsed);if(restored.options.mode==='coop')throw Error('合作关卡存档请通过合作原型读取');if(await prepareBattle(restored)){setPause(true);save(false);toast('战斗存档已导入。');}}catch(err){toast('导入失败：'+err.message);}e.target.value='';};
canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),y=(e.clientY-r.top)/r.height*500;
 if(landscape.matches&&(y<L.lanes[0].y-18||y>L.lanes[7].y+22))return;
 if(command(0,'lane',L.pickLane(y))&&landscape.matches)command(0,'send');canvas.focus({preventScroll:true});};
document.addEventListener('keydown',e=>{
 if(loading||ArmyShop.isOpen()||document.querySelector('dialog[open]')||!sim||$('battle').hidden||/^(INPUT|SELECT)$/.test(e.target.tagName))return;
 if(['KeyP','Escape'].includes(e.code)){e.preventDefault();if(!e.repeat)setPause(!paused);return;}
 if(e.code==='KeyQ'){e.preventDefault();if(!e.repeat)command(0,'rally');return;}
 if(e.code==='KeyE'||e.code==='ShiftRight'){e.preventDefault();if(!e.repeat){const owner=e.code==='KeyE'?0:1;command(owner,'special',!sim.players[owner].special);}return;}
 const map={KeyW:[0,'lane',-1],KeyS:[0,'lane',1],KeyA:[0,'select',-1],KeyD:[0,'select',1],Space:[0,'send'],ArrowUp:[1,'lane',-1],ArrowDown:[1,'lane',1],ArrowLeft:[1,'select',-1],ArrowRight:[1,'select',1],Enter:[1,'send']};
 const a=map[e.code];if(!a)return;e.preventDefault();if(e.repeat&&a[1]!=='send')return;const p=sim.players[a[0]];let val;
 if(a[1]==='lane')val=Math.max(0,Math.min(7,p.lane+a[2]));if(a[1]==='select'){const list=sim.roster(a[0]);val=list[(list.indexOf(p.selected)+a[2]+list.length)%list.length];}command(a[0],a[1],val);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim&&!paused&&sim.winner===null&&!$('battle').hidden)setPause(true);});
window.addEventListener('beforeunload',()=>{if(sim&&sim.winner===null)save(false);});
function touchCommand(action,value){if(!sim)return;const p=sim.players[0],list=sim.roster(0);if(action==='lane')command(0,'lane',Math.max(0,Math.min(7,p.lane+value)));if(action==='select')command(0,'select',list[(list.indexOf(p.selected)+value+list.length)%list.length]);if(action==='send')command(0,'send');canvas.focus({preventScroll:true});}
for(const [id,action,value]of [['touchUp','lane',-1],['touchDown','lane',1],['touchPrevious','select',-1],['touchNext','select',1],['touchSend','send',0]])$(id).onclick=()=>touchCommand(action,value);
$('touchAuto').onchange=()=>{command(0,'auto',$('touchAuto').checked);updateUi();};$('touchPause').onclick=()=>setPause(!paused);
async function load(){
 for(const id of ['race','enemyRace']){$(id).replaceChildren();for(const [key,r]of Object.entries(C.races)){const o=document.createElement('option');o.value=key;o.textContent=r.name;$(id).append(o);}}
 const requested=new URLSearchParams(location.search).get('race');$('race').value=Object.hasOwn(C.races,requested)?requested:'human';$('enemyRace').value='orc';await drawMenu();assetsReady=true;$('continueBtn').disabled=!storage.get();
}
load().catch(e=>toast('资源读取失败：'+e.message+'。请保留完整游戏文件夹。'));
window.__game={get battle(){return sim;},get paused(){return paused;},get ready(){return assetsReady;},start,setPause,render,step(n){for(let i=0;i<n;i++)sim.step();updateUi();render();}};
window.SoloGame={prepareBattle,toMenu,setPause,toast,async drawRace(c,race,current){if(globalThis.RacePicker)return RacePicker.draw(c,race,current);await ensureImages([1,5,0].flatMap(id=>C.atlas[race+'-'+id].files));if(!current())return;const target=c.getContext('2d');target.setTransform(2,0,0,2,0,0);target.clearRect(0,0,700,500);for(const [i,type]of [1,5,0].entries())drawUnit(target,{race,type,dir:i===0?-1:1},232.8+i*103.25,320,1.3801575,1);}};
requestAnimationFrame(loop);
})();

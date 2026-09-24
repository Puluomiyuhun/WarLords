/* Original 700x500 shop layout; shared by offline and authoritative co-op shops. */
(function(g){'use strict';
const P=g.Progression,C=g.CONTENT,S=g.SHOP_SOURCE||{},dialog=document.createElement('dialog');dialog.id='armyShop';dialog.className='army-shop';
dialog.innerHTML='<div class="shop-viewport"><div class="shop-stage"><header><h2 id="shopTitle">升级你的军队</h2><strong id="shopGold"></strong><small id="shopContext"></small></header><div id="shopBody"></div><p id="shopMessage" role="status"></p><footer class="shop-footer"><button id="shopBack">〈 返回</button><span id="shopArmyCount"></span><button id="shopClose">继续 〉</button></footer></div></div><div class="shop-local-options"><label>军队 <select id="shopOwner" aria-label="商店玩家"></select></label><label class="shop-enable"><input id="shopEnabled" type="checkbox">下一场使用这支军队</label><button id="shopReset">重置野战军备</button></div>';
document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);let config,owner=0,tab='army',selected=0,busy=false,epoch=0;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const size=()=>dialog.querySelector('.shop-stage').style.setProperty('--shop-scale',dialog.querySelector('.shop-viewport').getBoundingClientRect().width/700);new ResizeObserver(size).observe(dialog.querySelector('.shop-viewport'));
const army=()=>config.armies[owner];const message=text=>{$('shopMessage').textContent=text;};
function button(text,fn,disabled=false,cls='shop-link'){const b=el('button',text,cls);b.disabled=disabled||busy;b.onclick=fn;return b;}
function portrait(race,type,big=false){const box=el('div',undefined,big?'shop-portrait large':'shop-portrait'),im=el('img');im.alt='';im.src=`assets/shop-source-${race}-${type}.png`;box.append(im);return box;}
async function transact(action,value,success){if(busy)return;const token=epoch;let ok=false;
 if(config.onAction){busy=true;render();message('正在确认…');try{ok=await config.onAction(action,value);}catch{}finally{if(token===epoch)busy=false;}}
 else{const a=army();ok=action==='buyUnit'?P.buyUnit(a,value):action==='buyUpgrade'?P.buyUpgrade(a,value.unit,value.upgrade):P.dismiss(a,value);if(ok)config.onChange?.(owner);}
 if(token!==epoch)return;if(ok&&action==='dismiss')tab='army';render();message(ok?success:'操作未完成，请检查黄金、军队和房间状态。');
}
function show(type,page){selected=type;tab=page;message('');render();}
function stats(a,u){const list=el('div',undefined,'shop-stats');
 const entries=[['速度',u.speed,P.apply(u.speed,a.upgrades,u.id,'speed'),30],['装甲',u.health,P.apply(u.health,a.upgrades,u.id,'armour'),220],[u.ranged?'射程':'近战范围',u.range,u.range,u.ranged?1900:250],['伤害',S.power?.[u.id]||0,P.apply(S.power?.[u.id]||0,a.upgrades,u.id,'attack'),250],['准备时间',u.charge,u.charge,400]];
 for(const [name,base,value,max]of entries){const row=el('div',undefined,'shop-stat'),bar=el('div',undefined,'stat-track'),up=el('i',undefined,'stat-upgrade'),original=el('i',undefined,'stat-base');row.append(el('span',name));bar.title=name==='准备时间'?(value/24).toFixed(1)+' 秒':Number(value.toFixed(1)).toString();up.style.width=Math.min(100,value/max*100)+'%';original.style.width=Math.min(100,base/max*100)+'%';bar.append(up,original);row.append(bar);list.append(row);}return list;
}
function render(){const a=army(),body=$('shopBody');body.replaceChildren();body.className='shop-body '+(tab==='army'||tab==='recruit'?'list-view':'detail-view');$('shopTitle').textContent=config.onAction?(config.ownerLabel||'玩家')+'的军队':'升级你的军队';$('shopGold').textContent='黄金: '+a.gold;$('shopContext').textContent=C.races[a.race].name+(tab==='recruit'?' · 添加新的单位':tab==='sell'?' · 卖出单位':'');$('shopArmyCount').textContent=`${a.roster.length} / 10`;$('shopEnabled').checked=!!config.enabled[owner];$('shopBack').textContent=tab==='army'?(config.onAction?'〈 返回房间':'〈 主菜单'):'〈 返回';$('shopBack').disabled=busy;$('shopClose').disabled=busy;$('shopClose').textContent=config.onReady?'准备 〉':'继续 〉';
 if(tab==='army'||tab==='recruit'){
  const list=el('div',undefined,'shop-grid'),ids=tab==='army'?a.roster:C.races[a.race].roster.filter(id=>!a.roster.includes(id));
  for(const id of ids){const u=C.units[id],row=el('article',undefined,'shop-unit');row.append(portrait(a.race,id),el('strong',u.name,'shop-unit-name'));
   if(tab==='army'){row.append(button('升级 / 信息',()=>show(id,'detail'),false,'shop-link shop-info-link'));if(!P.BASE.includes(id))row.append(button('卖出',()=>show(id,'sell'),false,'shop-link shop-sell-link'));}
   else{row.append(el('small',u.category,'shop-unit-type'));row.append(button(`${u.price} 黄金 · 信息`,()=>show(id,'detail'),false,'shop-link shop-buy-info'));}list.append(row);
  }
  if(tab==='army'&&a.roster.length<10){const b=button('',()=>{tab='recruit';render();},false,'shop-add');b.id='shopRecruitTab';const icon=el('span','＋','shop-plus');b.append(icon,el('span','添加新的单位'));list.append(b);}body.append(list);
  if(!ids.length)body.append(el('p','本族已开放的部队均已招募。','shop-empty'));return;
 }
 const u=C.units[selected],owned=a.roster.includes(selected),head=el('div',undefined,'shop-detail-head');head.append(portrait(a.race,selected,true));const info=el('div',undefined,'shop-description');info.append(el('h3',u.name),el('span',u.category),el('p',u.description));if(u.bonus&&u.bonusAgainst?.length)info.append(el('p',`${u.bonus}% 攻击加成对：${u.bonusAgainst.map(id=>C.units[id]?.name).filter(Boolean).join('、')}`));head.append(info);body.append(head);
 if(tab==='sell'){body.append(el('p','卖出后保留已购买的升级。','shop-sell-note'));body.append(button(`卖出获得 ${Math.round(u.price/2)} 黄金`,()=>transact('dismiss',selected,'已卖出单位，已购升级保留。'),false,'shop-link shop-purchase'));return;}
 body.append(stats(a,u));
 if(!owned){const upgrades=Object.values(C.upgrades).filter(x=>P.eligible(a.race,selected,x.id));const panel=el('div',undefined,'shop-available');panel.append(el('strong','可用升级'),el('p',upgrades.map(x=>x.name).join('、')||'无'));if(u.caster)panel.append(el('p','需要另购法术，当前开放光球。'));body.append(panel,button(a.roster.length>=10?'军队已满':`购买需要 ${u.price} 黄金`,()=>transact('buyUnit',selected,'已招募 '+u.name),a.roster.length>=10||a.gold<u.price,'shop-link shop-purchase'));return;}
 const list=el('div',undefined,'shop-upgrades'),tip=el('div',undefined,'shop-upgrade-info');tip.setAttribute('aria-live','polite');const details=x=>{tip.replaceChildren(el('strong',x.name),el('p',x.description),el('small',`升级类型：${({armour:'护甲',attack:'攻击',speed:'速度',special:'特殊',magic:'魔法'})[x.kind]||'特殊'}${x.percent?' +'+x.percent+'%':''}${x.supported?'':' · 尚未开放'}`));};
 for(const x of Object.values(C.upgrades).filter(x=>P.eligible(a.race,selected,x.id))){const row=el('div',undefined,'shop-upgrade'),im=el('img');im.alt='';im.src=`assets/shop-upgrade-${S.upgradeIcons?.[x.id]||'special'}.png`;const bought=P.has(a.upgrades,selected,x.id),name=button(x.name,()=>details(x),false,'shop-upgrade-name');row.append(im,name,el('span',String(x.price),'shop-price'),button(bought?'已购买':x.supported?'购买':'未开放',()=>transact('buyUpgrade',{unit:selected,upgrade:x.id},'已购买 '+x.name),bought||!x.supported||a.gold<x.price,'shop-link shop-upgrade-buy'));row.onmouseenter=()=>details(x);row.onfocusin=()=>details(x);list.append(row);}
 body.append(list,tip);if(!list.children.length)tip.append(el('p','暂无可购买的升级。'));else if(u.specialUpgrade>=0)tip.append(el('p','购买特殊能力后，双倍充能出兵可触发特殊动作。'));else if(u.caster)tip.append(el('p','施法者需要购买法术，当前开放光球。'));
}
$('shopOwner').onchange=()=>{owner=Number($('shopOwner').value);tab='army';message('');render();};$('shopEnabled').onchange=()=>{config.enabled[owner]=$('shopEnabled').checked;config.onToggle?.(owner);};
$('shopBack').onclick=()=>{if(tab==='army')dialog.close();else{tab='army';message('');render();}};
$('shopClose').onclick=async()=>{if(busy)return;if(config.onReady){busy=true;render();let ok=false;try{ok=await config.onReady();}catch{}busy=false;if(!ok){render();return message('队友尚未连接或房间状态已改变。');}}dialog.close();};
dialog.onclose=()=>config?.onClose?.();$('shopReset').onclick=()=>{config.onReset?.(owner);tab='army';render();message('军队和野战资金已重置。');};
g.ArmyShop={open(c){epoch++;config=c;owner=0;tab='army';busy=false;dialog.querySelector('.shop-local-options').hidden=!!c.onAction;$('shopReset').hidden=!c.onReset;$('shopOwner').replaceChildren();c.armies.forEach((a,i)=>{const o=el('option',`玩家 ${i+1} · ${C.races[a.race].name}`);o.value=i;$('shopOwner').append(o);});message('');render();dialog.showModal();size();},update(armies){if(!config||!dialog.open)return;config.armies=armies;render();},close(){dialog.close();},isOpen:()=>dialog.open};
})(globalThis);

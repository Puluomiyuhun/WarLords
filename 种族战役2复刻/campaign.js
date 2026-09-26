/* Persistent single-player conquest. Region names, borders, armies and castles
   come from the supplied SWF; purchases share the co-op progression rules. */
(function(g){'use strict';
const C=typeof module!=='undefined'?require('./content.js'):g.CONTENT;
const P=typeof module!=='undefined'?require('./progression.js'):g.Progression;
const REGIONS=typeof module!=='undefined'?require('./campaign-data.js'):g.CAMPAIGN_REGIONS;
const region=id=>REGIONS.find(r=>r.id===id);
const homeland=race=>C.races[race]?.homeRegion?[C.races[race].homeRegion]:REGIONS.filter(r=>r.race===race).map(r=>r.id);
function create(race,seed=Date.now()>>>0){
 const army=P.createArmy(race,500);
 return {format:'warlords2-campaign',version:2,occupiers:{},pendingDefense:null,id:race+'-'+seed,race,army,owned:homeland(race),phase:'shop',battle:null,active:null,attempt:0,wins:0,history:[],seed:seed>>>0,result:null};
}
function territory(c,id){const r=region(id),race=c.occupiers?.[id];return race?{...r,race,roster:C.races[race].roster.slice(0,10)}:r;}
function targets(c){if(c.pendingDefense)return [region(c.pendingDefense.id)];const ids=new Set(c.owned.flatMap(id=>region(id).adjacent));return REGIONS.filter(r=>ids.has(r.id)&&!c.owned.includes(r.id)).map(r=>territory(c,r.id));}
function planDefense(c){if(c.wins<=10||c.owned.length===REGIONS.length)return;let x=(c.seed^Math.imul(c.attempt+1,2654435761))>>>0;const random=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};for(const id of c.owned){const r=region(id);if(!r.castle)continue;for(const from of r.adjacent)if(!c.owned.includes(from)&&random()<.05){c.pendingDefense={id,from};return;}}}
function begin(c,id){
 if(!['map','shop'].includes(c.phase)||!targets(c).some(r=>r.id===id))throw Error('请选择与领土相邻的敌方地区');
 const defense=c.pendingDefense?.id===id,r=defense?territory(c,c.pendingDefense.from):territory(c,id),site=region(id),nonce=c.id+':'+(++c.attempt);c.active={id,nonce,defense,attacker:r.race};c.phase='battle';c.battle=null;c.result=null;
 const upgrades=Object.fromEntries(r.roster.filter(id=>C.units[id].caster&&P.eligible(r.race,id,17)).map(id=>[id,[17]]));
 return {mode:'solo',races:[c.race,r.race],rosters:[c.army.roster.slice(),r.roster.slice()],upgrades:[structuredClone(c.army.upgrades),upgrades],difficulty:r.difficulty,terrain:site.terrain,seed:(c.seed+c.attempt*2654435761)>>>0,siege:site.castle?{side:defense?0:1,target:7500}:null,campaign:{id:c.id,nonce,region:id}};
}
function settle(c,b){
 const tag=b.options.campaign;
 if(c.phase!=='battle'||!tag||tag.id!==c.id||tag.nonce!==c.active?.nonce||tag.region!==c.active.id||b.winner===null)return null;
 const r=region(c.active.id),won=b.winner===0;
 const defense=!!c.active.defense,bonuses={territory:won&&!defense?r.reward:0,kills:Math.round(b.players[0].killReward||0),time:won?Math.round(Math.max(0,300-b.tick/24)/10):0,difficulty:won?Math.round(b.options.difficulty*10):0},reward=Object.values(bonuses).reduce((a,n)=>a+n,0);
 c.army.gold+=reward;
 if(won){if(!defense){c.owned.push(r.id);delete c.occupiers[r.id];}c.wins++;}else if(defense){c.owned=c.owned.filter(id=>id!==r.id);c.occupiers[r.id]=c.active.attacker;}
 c.pendingDefense=null;
 c.result={region:r.id,won,defense,reward,bonuses,kills:b.players[0].kills,seconds:Math.floor(b.tick/24)};c.history.push({...c.result,nonce:tag.nonce});c.battle=null;c.active=null;c.phase=c.owned.length===REGIONS.length?'complete':c.owned.length?'shop':'defeated';if(c.phase==='shop')planDefense(c);return c.result;
}
function restore(input){
 const c=structuredClone(input);if(c?.version===1){c.version=2;c.occupiers={};c.pendingDefense=null;}
 if(!c||c.format!=='warlords2-campaign'||c.version!==2||typeof c.id!=='string'||c.id.length>100||(!P.validateArmy(c.army)||c.army.mercenaries)||c.race!==c.army.race||!Array.isArray(c.owned)||c.owned.length>28||new Set(c.owned).size!==c.owned.length||!c.owned.every(id=>!!region(id))||!['map','shop','battle','complete','defeated'].includes(c.phase)||![c.attempt,c.wins,c.seed].every(n=>Number.isSafeInteger(n)&&n>=0)||c.wins<c.owned.length-homeland(c.race).length||!Array.isArray(c.history)||c.history.length>10000)throw Error('战役存档不正确');
 if(!c.occupiers||Array.isArray(c.occupiers)||typeof c.occupiers!=='object'||!Object.entries(c.occupiers).every(([id,race])=>region(Number(id))&&!c.owned.includes(Number(id))&&Object.hasOwn(C.races,race)))throw Error('领土归属不正确');
 if(c.pendingDefense&&(!c.owned.includes(c.pendingDefense.id)||!region(c.pendingDefense.id)?.castle||!region(c.pendingDefense.id).adjacent.includes(c.pendingDefense.from)||c.owned.includes(c.pendingDefense.from)))throw Error('反攻地区不正确');
 if(c.phase==='defeated'&&c.owned.length!==0||c.phase!=='defeated'&&c.owned.length===0)throw Error('战役存亡状态不正确');
 if(c.phase==='complete'&&c.owned.length!==28)throw Error('战役进度不正确');
 if(c.phase==='battle'&&(!c.active||typeof c.active.nonce!=='string'||!targets(c).some(r=>r.id===c.active.id)))throw Error('战役关卡不正确');
 if(c.battle){const t=c.battle.options?.campaign;if(c.phase!=='battle'||!t||t.id!==c.id||t.nonce!==c.active.nonce||t.region!==c.active.id||c.battle.options.races[0]!==c.race||JSON.stringify(c.battle.options.rosters[0])!==JSON.stringify(c.army.roster)||JSON.stringify(c.battle.options.upgrades[0])!==JSON.stringify(c.army.upgrades))throw Error('战斗与战役不匹配');}
 return c;
}
const api={REGIONS,region,territory,planDefense,create,targets,begin,settle,restore};if(typeof module!=='undefined')module.exports=api;else g.Campaign=api;
})(globalThis);

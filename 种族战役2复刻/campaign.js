/* Persistent single-player conquest. Region names, borders, armies and castles
   come from the supplied SWF; purchases share the co-op progression rules. */
(function(g){'use strict';
const C=typeof module!=='undefined'?require('./content.js'):g.CONTENT;
const P=typeof module!=='undefined'?require('./progression.js'):g.Progression;
const REGIONS=typeof module!=='undefined'?require('./campaign-data.js'):g.CAMPAIGN_REGIONS;
const region=id=>REGIONS.find(r=>r.id===id);
function create(race,seed=Date.now()>>>0){
 const army=P.createArmy(race,500);
 return {format:'warlords2-campaign',version:1,id:race+'-'+seed,race,army,owned:REGIONS.filter(r=>r.race===race).map(r=>r.id),phase:'shop',battle:null,active:null,attempt:0,wins:0,history:[],seed:seed>>>0,result:null};
}
function targets(c){const ids=new Set(c.owned.flatMap(id=>region(id).adjacent));return REGIONS.filter(r=>ids.has(r.id)&&!c.owned.includes(r.id));}
function begin(c,id){
 if(!['map','shop'].includes(c.phase)||!targets(c).some(r=>r.id===id))throw Error('请选择与领土相邻的敌方地区');
 const r=region(id),nonce=c.id+':'+(++c.attempt);c.active={id,nonce};c.phase='battle';c.battle=null;c.result=null;
 const upgrades=Object.fromEntries(r.roster.filter(id=>C.units[id].caster&&P.eligible(r.race,id,17)).map(id=>[id,[17]]));
 return {mode:'solo',races:[c.race,r.race],rosters:[c.army.roster.slice(),r.roster.slice()],upgrades:[structuredClone(c.army.upgrades),upgrades],difficulty:r.difficulty,terrain:r.terrain,seed:(c.seed+c.attempt*2654435761)>>>0,siege:r.castle?{side:1,target:7500}:null,campaign:{id:c.id,nonce,region:id}};
}
function settle(c,b){
 const tag=b.options.campaign;
 if(c.phase!=='battle'||!tag||tag.id!==c.id||tag.nonce!==c.active?.nonce||tag.region!==c.active.id||b.winner===null)return null;
 const r=region(c.active.id),won=b.winner===0;
 const reward=won?r.reward+Math.min(500,b.players[0].kills*5):0;
 if(won){c.owned.push(r.id);c.wins++;c.army.gold+=reward;}
 c.result={region:r.id,won,reward,kills:b.players[0].kills,seconds:Math.floor(b.tick/24)};c.history.push({...c.result,nonce:tag.nonce});c.battle=null;c.active=null;c.phase=c.owned.length===REGIONS.length?'complete':'shop';return c.result;
}
function restore(input){
 const c=structuredClone(input);
 if(!c||c.format!=='warlords2-campaign'||c.version!==1||typeof c.id!=='string'||c.id.length>100||!P.validateArmy(c.army)||c.race!==c.army.race||!Array.isArray(c.owned)||c.owned.length>28||new Set(c.owned).size!==c.owned.length||!c.owned.every(id=>!!region(id))||!REGIONS.filter(r=>r.race===c.race).every(r=>c.owned.includes(r.id))||!['map','shop','battle','complete'].includes(c.phase)||![c.attempt,c.wins,c.seed].every(n=>Number.isSafeInteger(n)&&n>=0)||c.wins!==c.owned.length-REGIONS.filter(r=>r.race===c.race).length||!Array.isArray(c.history)||c.history.length>10000)throw Error('战役存档不正确');
 if(c.phase==='complete'&&c.owned.length!==28)throw Error('战役进度不正确');
 if(c.phase==='battle'&&(!c.active||typeof c.active.nonce!=='string'||!targets(c).some(r=>r.id===c.active.id)))throw Error('战役关卡不正确');
 if(c.battle){const t=c.battle.options?.campaign;if(c.phase!=='battle'||!t||t.id!==c.id||t.nonce!==c.active.nonce||t.region!==c.active.id||c.battle.options.races[0]!==c.race||JSON.stringify(c.battle.options.rosters[0])!==JSON.stringify(c.army.roster)||JSON.stringify(c.battle.options.upgrades[0])!==JSON.stringify(c.army.upgrades))throw Error('战斗与战役不匹配');}
 return c;
}
const api={REGIONS,region,create,targets,begin,settle,restore};if(typeof module!=='undefined')module.exports=api;else g.Campaign=api;
})(globalThis);

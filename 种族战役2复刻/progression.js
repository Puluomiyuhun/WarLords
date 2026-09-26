/* Original shop eligibility, per-unit purchases, independent player armies. */
(function(g){'use strict';
const C=typeof module!=='undefined'?require('./content.js'):g.CONTENT;
const BASE=[0,1,2,5],MAX_ARMY=10;
const baseRoster=race=>C.races[race]?.baseRoster||BASE;
let specialCache;
const foreignSpecials=()=>specialCache??=(C.order.filter(id=>!C.units[id].summonOnly&&Object.values(C.races).filter(r=>r.roster.includes(id)).length<=2));
function recruitRoster(a){return [...new Set([...C.races[a.race].roster,...(a.mercenaries===true?foreignSpecials():[])])];}
function unitRace(a,type){return C.races[a.race]?.roster.includes(type)?a.race:a.mercenaries===true&&foreignSpecials().includes(type)?Object.keys(C.races).find(r=>C.races[r].roster.includes(type)):a.race;}
function unitPrice(a,type){return C.units[type].price*(unitRace(a,type)!==a.race?2:1);}
function armyUpgrades(a){return a.upgrades&&typeof a.upgrades==='object'&&!Array.isArray(a.upgrades)&&Object.entries(a.upgrades).every(([type,ids])=>recruitRoster(a).includes(Number(type))&&validUpgrades(unitRace(a,Number(type)),{[type]:ids}));}
function eligible(race,type,id){if(type>=100&&! [6,7,8,10,11].includes(id))return false;const r=C.races[race],u=C.upgrades[id];return Object.hasOwn(C.races,race)&&!!u&&r.roster.includes(type)&&(u.raceIndex===-1||u.raceIndex===r.sourceIndex)&&(u.include?u.units.includes(type):!u.units.includes(type));}
function has(upgrades,type,id){return (upgrades?.[type]||[]).includes(id);}
function apply(base,upgrades,type,kind){return base*(1+(upgrades?.[type]||[]).reduce((n,id)=>n+(C.upgrades[id]?.kind===kind?C.upgrades[id].percent:0),0)/100);}
function validUpgrades(race,upgrades){return upgrades&&typeof upgrades==='object'&&!Array.isArray(upgrades)&&Object.entries(upgrades).every(([type,ids])=>Array.isArray(ids)&&ids.length<=48&&new Set(ids).size===ids.length&&ids.every(id=>Number.isInteger(id)&&C.upgrades[id]?.supported&&eligible(race,Number(type),id)));}
function createArmy(race,gold=500){if(!Object.hasOwn(C.races,race))throw Error('种族不正确');return {race,gold,roster:baseRoster(race).slice(),upgrades:{}};}
function validateArmy(a){return !!a&&Object.hasOwn(C.races,a.race)&&Number.isSafeInteger(a.gold)&&a.gold>=0&&a.gold<=10000000&&Array.isArray(a.roster)&&a.roster.length>=4&&a.roster.length<=MAX_ARMY&&new Set(a.roster).size===a.roster.length&&[BASE,baseRoster(a.race)].some(base=>base.every((id,i)=>a.roster[i]===id))&&(a.mercenaries===undefined||a.mercenaries===true)&&a.roster.every(id=>recruitRoster(a).includes(id))&&armyUpgrades(a);}
function buyUnit(a,type){if(!validateArmy(a)||!Number.isInteger(type)||!recruitRoster(a).includes(type)||a.roster.includes(type)||a.roster.length>=MAX_ARMY||a.gold<unitPrice(a,type))return false;a.gold-=unitPrice(a,type);a.roster.push(type);return true;}
function buyUpgrade(a,type,id){if(!validateArmy(a)||!a.roster.includes(type)||!Number.isInteger(id)||!C.upgrades[id]?.supported||!eligible(unitRace(a,type),type,id)||has(a.upgrades,type,id)||a.gold<C.upgrades[id].price)return false;a.gold-=C.upgrades[id].price;(a.upgrades[type]??=[]).push(id);return true;}
function dismiss(a,type){if(!validateArmy(a)||a.roster.slice(0,4).includes(type)||!a.roster.includes(type))return false;a.roster=a.roster.filter(id=>id!==type);a.gold+=Math.round(unitPrice(a,type)/2);return true;}
const api={recruitRoster,unitRace,unitPrice,armyUpgrades,BASE,baseRoster,MAX_ARMY,eligible,has,apply,validUpgrades,createArmy,validateArmy,buyUnit,buyUpgrade,dismiss};if(typeof module!=='undefined')module.exports=api;else g.Progression=api;
})(globalThis);

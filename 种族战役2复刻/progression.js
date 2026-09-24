/* Original shop eligibility, per-unit purchases, independent player armies. */
(function(g){'use strict';
const C=typeof module!=='undefined'?require('./content.js'):g.CONTENT;
const BASE=[0,1,2,5],MAX_ARMY=10;
function eligible(race,type,id){const r=C.races[race],u=C.upgrades[id];return Object.hasOwn(C.races,race)&&!!u&&r.roster.includes(type)&&(u.raceIndex===-1||u.raceIndex===r.sourceIndex)&&(u.include?u.units.includes(type):!u.units.includes(type));}
function has(upgrades,type,id){return (upgrades?.[type]||[]).includes(id);}
function apply(base,upgrades,type,kind){return base*(1+(upgrades?.[type]||[]).reduce((n,id)=>n+(C.upgrades[id]?.kind===kind?C.upgrades[id].percent:0),0)/100);}
function validUpgrades(race,upgrades){return upgrades&&typeof upgrades==='object'&&!Array.isArray(upgrades)&&Object.entries(upgrades).every(([type,ids])=>Array.isArray(ids)&&ids.length<=48&&new Set(ids).size===ids.length&&ids.every(id=>Number.isInteger(id)&&C.upgrades[id]?.supported&&eligible(race,Number(type),id)));}
function createArmy(race,gold=500){if(!Object.hasOwn(C.races,race))throw Error('种族不正确');return {race,gold,roster:BASE.slice(),upgrades:{}};}
function validateArmy(a){return !!a&&Object.hasOwn(C.races,a.race)&&Number.isSafeInteger(a.gold)&&a.gold>=0&&a.gold<=10000000&&Array.isArray(a.roster)&&a.roster.length>=4&&a.roster.length<=MAX_ARMY&&new Set(a.roster).size===a.roster.length&&BASE.every((id,i)=>a.roster[i]===id)&&a.roster.every(id=>C.races[a.race].roster.includes(id))&&validUpgrades(a.race,a.upgrades);}
function buyUnit(a,type){if(!validateArmy(a)||!Number.isInteger(type)||!C.races[a.race].roster.includes(type)||a.roster.includes(type)||a.roster.length>=MAX_ARMY||a.gold<C.units[type].price)return false;a.gold-=C.units[type].price;a.roster.push(type);return true;}
function buyUpgrade(a,type,id){if(!validateArmy(a)||!a.roster.includes(type)||!Number.isInteger(id)||!C.upgrades[id]?.supported||!eligible(a.race,type,id)||has(a.upgrades,type,id)||a.gold<C.upgrades[id].price)return false;a.gold-=C.upgrades[id].price;(a.upgrades[type]??=[]).push(id);return true;}
function dismiss(a,type){if(!validateArmy(a)||BASE.includes(type)||!a.roster.includes(type))return false;a.roster=a.roster.filter(id=>id!==type);a.gold+=Math.round(C.units[type].price/2);return true;}
const api={BASE,MAX_ARMY,eligible,has,apply,validUpgrades,createArmy,validateArmy,buyUnit,buyUpgrade,dismiss};if(typeof module!=='undefined')module.exports=api;else g.Progression=api;
})(globalThis);

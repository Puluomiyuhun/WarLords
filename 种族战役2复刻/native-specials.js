/* Two conservative player-only support prototypes. Original body atlases stay intact. */
(function(g){'use strict';function apply(C){if(C.units[105])return;
const medic=Object.assign(structuredClone(C.units[3]),{id:105,name:'战地医护',description:'西方人类专属。每7秒可向同路180距离内的一名受伤友军投出治疗光球，按原光球速度抵达后恢复18生命，不能超过上限。同一目标4秒内只能接受一次救治；不能治疗医护、倒地单位和攻城机械。冷却时会跟随附近受伤友军，满血后继续前进。没有攻击能力，需要前排保护。',category:'支援步兵',health:35,charge:156,price:1400,speed:3,range:180,caster:false,ranged:false,usesAmmo:false,projectile:null,specialUpgrade:-1,bonus:0,bonusAgainst:[],counters:[2,4],swipes:1,medic:true,playerOnly:true});
for(const e of Object.values(medic.frames)){delete e.arrow;delete e.projectile;if(e.moveAmount)e.moveAmount=Math.sign(e.moveAmount)*3;}
medic.frames[128]={heal:true};
const hunter=Object.assign(structuredClone(C.units[2]),{id:106,name:'缚根猎手',description:'森林精灵专属。每7秒可射出一支缚根箭，命中后减速2秒：步兵50%，骑兵和战象25%。目标触发后5秒内不再受缚根影响。箭伤低于普通弓手，盾牌可挡住缚根箭。',category:'控场射手',health:25,charge:156,price:1300,speed:3,range:1200,caster:false,specialUpgrade:-1,bonus:0,bonusAgainst:[],rootHunter:true,playerOnly:true});
for(const [id,race,source,u]of [[105,'human2',3,medic],[106,'woodelf',2,hunter]]){C.units[id]=u;C.atlas[race+'-'+id]=id===105?{...C.atlas[race+'-'+source],healingGlow:true}:C.atlas[race+'-'+source];C.races[race].roster.push(id);C.order.push(id);}
C.rulesVersion='0.9.2-rally-exit';
if(typeof module!=='undefined'){require('./native-reinforcements.js')(C);require('./finished-content.js')(C);require('./restoration-content.js')(C);require('./native-weapon-content.js')(C);}
}if(typeof module!=='undefined')module.exports=apply;else apply(g.CONTENT);})(globalThis);

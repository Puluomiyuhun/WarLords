/* Six native additions: original body atlases/timelines, restrained support mechanics. */
(function(g){'use strict';function apply(C){if(C.nativeReinforcements)return;
const specs=[
 [107,'elf',3,{name:'银月结界卫',description:'每8秒为同路220距离内一名友军附加35点魔法护盾，持续5秒，不叠加。只吸收魔法伤害，不能挡刀剑、箭矢、即死与控制。无攻击，需要前排保护。',category:'结界支援',health:35,charge:168,price:1400,speed:3,range:220,supportCast:'ward',nonCombat:true,ranged:false}],
 [108,'orc',15,{name:'裂甲勇士',description:'使用长柄战镐。每第三次有效近战命中造成裂甲：目标承受近战伤害增加20%，持续3秒，同类不叠加。盾牌挡住的攻击不计数，不作用于城堡。普通攻击伤害略低于战斗斧兵。',category:'破甲步兵',health:90,charge:144,price:1350,speed:4,range:110,breaker:true}],
 [109,'orc2',11,{name:'钩刃猎手',description:'每8秒可将同路100～220距离内最前方的普通步兵拉近最多70距离，保持近战间隔，不穿越其他单位。不能拉骑兵、巨型单位或城堡，不眩晕。远处仍会投斧，但伤害较低。',category:'牵制射手',health:45,charge:156,price:1250,speed:3,hooker:true}],
 [110,'undead',3,{name:'收魂侍者',description:'同路240距离内普通士兵阵亡时收集魂火，最多3魂；每个死亡只供给一名侍者。消耗3魂，在原施术动作后治疗180距离内一名受伤友军25生命，间隔至少6秒，并遵守4秒受疗锁。无攻击，不复活，不从召唤物收魂。',category:'收魂支援',health:40,charge:168,price:1500,speed:3,range:180,supportCast:'soul',nonCombat:true,ranged:false}],
 [111,'troll',15,{name:'磐石守卫',description:'使用宽刃重斧。近身交战时停止推进，站稳1.5秒后获得磐石姿态：推退距离减少60%，可挡一次骑兵撞飞（冷却8秒）。移动、击倒或敌人离开后重置。不减免伤害，远程依然能有效对付它。',category:'守线步兵',health:100,charge:150,price:1450,speed:3,range:130,stoneGuard:true}],
 [112,'demon',1,{name:'烙印猎手',description:'有效近战命中留下4秒烙印，再次被烙印猎手命中时引爆：额外24点伤害，并灼伤同路100距离内最近的另一名敌人12点。每名猎手及同一目标的引爆间隔至少3秒，不连锁，不影响治疗。',category:'爆燃步兵',health:95,charge:120,price:1400,speed:3,range:100,brander:true}]
];C.nativeReinforcements={};
for(const [id,race,source,props]of specs){const u=Object.assign(structuredClone(C.units[source]),{id,caster:false,usesAmmo:false,specialUpgrade:-1,bonus:0,bonusAgainst:[],playerOnly:true},props);for(const e of Object.values(u.frames))if(e.moveAmount!==undefined)e.moveAmount=Math.sign(e.moveAmount)*u.speed;if(u.nonCombat){u.projectile=null;for(const e of Object.values(u.frames)){delete e.arrow;delete e.hit;delete e.impact;delete e.projectile;}u.frames[128]={supportCast:true};}if(u.stoneGuard){for(let f=80;f<=90;f++)u.frames[f].speed=3;u.frames[99].hit={range:130,power:10,height:'MIDDLE'};u.frames[115].hit={range:130,power:50/3,height:'HIGH'};}if(u.breaker)for(const e of Object.values(u.frames))if(e.hit)e.hit.power*=.8;
 C.units[id]=u;C.atlas[race+'-'+id]=C.atlas[race+'-'+source];C.races[race].roster.push(id);C.order.push(id);C.nativeReinforcements[id]={race,source};}
}if(typeof module!=='undefined')module.exports=apply;else apply(g.CONTENT);})(globalThis);

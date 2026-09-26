/* Original upgrade eligibility, cast counts and authored release frames. */
(function(g){'use strict';function apply(C){if(C.spells)return;
 const specs=[
 [14,2,300,3000,true,72],[15,3,10,1500,false,147],[16,1,0,0,true,178],[17,10,300,5000,false,225],
 [18,3,300,4000,true,282],[19,5,200,1000,false,318],[20,2,1000,5000,true,385],[21,3,500,3000,true,430],
 [22,5,10,1000,false,505],[23,2,0,3000,false,552],[24,1,0,1000,false,587],[25,3,300,5000,false,620],
 [26,3,50,2000,false,654],[27,1,50,2000,false,704],[28,5,50,2000,false,754],[29,3,0,0,true,801],
 [30,3,50,3000,false,846],[31,5,50,3000,false,896]];
 C.spells=Object.fromEntries(specs.map(([id,limit,min,max,all,frame],i)=>[id,{id,limit,min,max,all,frame,pose:'spell'+(i+1)}]));
 for(const id of [...specs.map(s=>s[0]),34,35,36,37])C.upgrades[id].supported=true;
 // The resurrected skeleton is a summon, never a purchasable or random-wave troop.
 const skeleton=Object.assign(structuredClone(C.units[0]),{id:48,name:'复生骷髅',description:'死灵法师从敌军尸体中召出的骷髅。',speed:8,health:25,price:10,charge:100,range:100,bonus:0,bonusAgainst:[],specialUpgrade:-1,swipes:1,totalFrames:69,labels:{ready:13,walk:19,swipe1:31,die1:45},frames:{13:{ready:true},18:{jump:13},30:{jump:13},44:{jump:13},69:{stop:true}},summonOnly:true});
 for(let i=19;i<=29;i++)skeleton.frames[i]={move:true};for(let i=31;i<=43;i++)skeleton.frames[i]={move:true};skeleton.frames[40].impact={range:50,power:30};C.units[48]=skeleton;C.order.push(48);
 // Original scythe whirlwind frame 92 retreats only within 70 world units.
 C.units[34].frames[92]={move:true,moveFactor:1,retreatIfCloserThan:70};
 C.rallyKillsRequired=35;
 C.rulesVersion='0.10.8-defense-return';
 if(typeof module!=='undefined')require('./restoration-atlas.js')(C);
}if(typeof module!=='undefined')module.exports=apply;else apply(g.CONTENT);})(globalThis);

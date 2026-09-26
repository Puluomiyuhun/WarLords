/* Local Persian faction prototype. Shared infantry keep their original rules. */
(function(g){'use strict';function apply(C){
 if(C.races.persian)return;
 const clone=id=>structuredClone(C.units[id]);
 C.units[101]=Object.assign(clone(31),{id:101,name:'藤盾卫士',health:110,price:1100,charge:130,speed:2.5,description:'波斯专属。举盾行进，拦截身后200距离内友军受到的普通箭矢；攻击时盾牌打开。巨石与魔法不受此掩护影响。',specialUpgrade:-1});
 C.units[102]=Object.assign(clone(18),{id:102,name:'不死军',health:150,price:1800,charge:190,description:'波斯专属精锐。首次致命伤后跪地重整3秒，若敌军未越过其位置，以30%生命重新作战。每名士兵仅一次。',specialUpgrade:-1});
 function elephant(id,heavy){const end=heavy?86:50,total=end+24,hit=heavy?44:28,frames={1:{ready:true},14:{reset:true},[hit]:{hit:{range:heavy?120:110,power:heavy?55:35,height:'MIDDLE'}},[end]:{reset:true},[total]:{stop:true}};
  for(let i=2;i<=13;i++)frames[i]={move:true,accelerate:.15};
  return {id,name:heavy?'王庭重象':'轻装战象',description:heavy?'替代重骑。慢速厚甲，长时间蓄势后推开前方最多两名步兵；长矛和戟兵能抵抗推击。无法被普通击飞。':'替代轻骑。缓慢加速，以象牙顶击并推退最前方敌人。速度远低于马，适合正面推进。',speed:heavy?1.5:2,health:heavy?300:180,charge:heavy?360:240,range:heavy?120:110,price:heavy?2600:1700,bonus:0,bonusAgainst:[],counters:[0,5,2,3],ranged:false,usesAmmo:false,big:true,ram:false,projectile:null,caster:false,specialUpgrade:-1,category:'战象',swipes:1,frames,labels:{ready:1,walk:2,swipe1:15,die1:end+1},totalFrames:total,genericAnimations:false,elephant:true,maxSpeed:heavy?3:5,heavy,sourceType:heavy?6:4};
 }
 C.units[103]=elephant(103,false);C.units[104]=elephant(104,true);
 C.races.persian={id:'persian',name:'中东民族 · 波斯',color:[66,100,109],sourceIndex:9,baseRoster:[0,1,2,5],roster:[0,1,2,5,101,102,103,104,7,3,8,15,19,27],description:'蓝绿布衣与暗银甲片的波斯王庭。通用步兵编制，藤盾与不死军护阵，两种战象替代全部骑兵。',story:'王庭的军旗越过沙海，步兵护住阵线，战象缓缓踏向城门。',homeRegion:26};
 for(const id of C.races.persian.roster){if(id>=103)continue;const source=id===101?'human2-31':id===102?'human-18':'human-'+id;C.atlas['persian-'+id]={...C.atlas[source],persianSkin:true};}
 for(const key of ['castle','climb','ladder','enter'])C.atlas['persian-'+key]=C.atlas['human-'+key];
 C.effects.persian={...C.effects.human,persianSkin:true};
 const sheets=typeof module!=='undefined'?require('./persian-sprites.js'):g.PERSIAN_SPRITES;
 for(const id of [0,1,2,101,102,103,104]){const d=C.units[id],sheet=sheets[id],file=sheet.file;
  if(sheet.nativeAtlas){C.atlas['persian-'+id]=structuredClone(sheet.nativeAtlas);continue;}
  const rects=Array.from({length:d.totalFrames},(_,n)=>{const f=n+1;let pose=0;
   if(id>=103)pose=f>=d.labels.die1?(f<d.labels.die1+8?6:7):f>=15?(f<(d.heavy?44:28)?4:5):f>=2&&f<=13?1+Math.floor((f-2)/4)%3:0;
   else if(f>=d.labels.die1&&f<(id===102?81:125))pose=f<d.labels.die1+12?6:7;
   else if(id===101&&f>=26&&f<=36||id===102&&f>=11&&f<=21)pose=1+Math.floor((f-d.labels.walk)/4)%3;
   else if(f>=d.labels.swipe1)pose=d.frames[f]?.hit?5:(f%16<8?4:5);
   const r=sheet.poses[pose],size=id===103?220:id===104?240:120;
   return {x:r.x,y:r.y,w:r.w,h:r.h,ox:-size/2,oy:-r.bottom/r.h*size,page:0,dw:size,dh:size};});
  C.atlas['persian-'+id]={file,files:[file],pages:[{file,width:sheet.width,height:sheet.height}],frames:d.totalFrames,frameRects:rects,fullResolution:true,runtimeShadow:true,labels:d.labels};
 }
 C.order.push(101,102,103,104);C.rulesVersion='0.9.0-coop';if(typeof module!=='undefined')require('./native-specials.js')(C);
}
if(typeof module!=='undefined')module.exports=apply;else apply(g.CONTENT);
})(globalThis);

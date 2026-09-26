/* Authoritative support state; all durations use fixed simulation ticks. */
(function(g){'use strict';function install(Battle,C){const B=Battle.prototype;
B.supportFriend=function(u,v,range=Infinity){return this.active(v)&&v.id!==u.id&&v.side===u.side&&v.lane===u.lane&&!v.knockFrame&&!C.units[v.type].big&&!C.units[v.type].nonCombat&&!C.units[v.type].medic&&Math.abs(v.x-u.x)<=range;};
B.supportTarget=function(u,range=C.units[u.type].range){const d=C.units[u.type];return this.units.filter(v=>this.supportFriend(u,v,range)&&(d.supportCast==='ward'?!(v.wardHp>0&&v.wardUntil>this.tick):v.hp<v.maxHp&&this.tick>=(v.healLockUntil||0))).sort((a,b)=>d.supportCast==='ward'?Math.abs(a.x-u.x)-Math.abs(b.x-u.x)||a.id-b.id:a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];};
B.nativeDecide=function(u){const d=C.units[u.type];if(d.supportCast){const ready=this.tick>=(u.nativeReadyAt||0)&&(d.supportCast==='ward'||u.souls>=3),v=ready&&this.supportTarget(u);u.targetId=v?.id??null;if(v){u.nativeReadyAt=this.tick+(d.supportCast==='ward'?192:144);u.frame=d.labels.swipe1;}else{const follow=this.supportTarget(u,600);u.frame=follow&&Math.abs(follow.x-u.x)>100?((follow.x-u.x)*u.dir<0?d.labels.walkback:d.labels.walk):this.target(u,180)||follow?(d.labels.ready||1):d.labels.walk;}return true;}
 if(d.hooker)u.hookPending=false;
 if(d.hooker&&this.tick>=(u.nativeReadyAt||0)){const front=this.units.filter(v=>this.active(v)&&v.side!==u.side&&v.lane===u.lane&&(v.x-u.x)*u.dir>0).sort((a,b)=>(a.x-b.x)*u.dir||a.id-b.id)[0],dist=front&&(front.x-u.x)*u.dir;if(front&&dist>100&&dist<=220&&this.hookable(front)){u.targetId=front.id;u.hookPending=true;u.nativeReadyAt=this.tick+192;u.frame=d.labels.swipe1;return true;}}return false;
};
B.nativeCast=function(u){const v=this.victim(u.targetId),d=C.units[u.type];if(!this.supportFriend(u,v,400))return;
 if(d.supportCast==='ward'){if(v.wardHp>0&&v.wardUntil>this.tick)return;v.wardHp=35;v.wardUntil=this.tick+120;v.wardPulseUntil=this.tick+24;}
 if(d.supportCast==='soul'){if(u.souls<3||v.hp>=v.maxHp||this.tick<(v.healLockUntil||0))return;u.souls-=3;v.hp=Math.min(v.maxHp,v.hp+this.healingAmount(v,25));v.healLockUntil=this.tick+96;v.healPulseUntil=this.tick+24;u.soulCastUntil=this.tick+18;u.soulTargetX=v.x;}
};
B.healingAmount=function(v,amount){return amount;};
B.absorbWard=function(v,amount){if(this.tick>=(v.wardUntil||0))v.wardHp=0;const absorbed=Math.min(amount,v.wardHp||0);if(absorbed>0){v.wardHp-=absorbed;v.wardPulseUntil=this.tick+24;}return Math.max(0,amount-absorbed);};
B.collectSoul=function(v){if(v.summoned||!C.units[v.type].genericAnimations||C.units[v.type].big)return;const collector=this.units.filter(u=>C.units[u.type].supportCast==='soul'&&this.active(u)&&!u.knockFrame&&(u.souls||0)<3&&u.lane===v.lane&&Math.abs(u.x-v.x)<=240).sort((a,b)=>Math.abs(a.x-v.x)-Math.abs(b.x-v.x)||a.id-b.id)[0];if(collector){collector.souls=(collector.souls||0)+1;collector.soulPulseUntil=this.tick+24;}};
B.nativeHit=function(u,v,damage){if(v.castle||damage<=0)return;const d=C.units[u.type];if(d.breaker){u.breakHits=((u.breakHits||0)+1)%3;if(u.breakHits===0&&!v.dead)v.breachUntil=this.tick+72;}
 if(d.brander&&!v.dead&&this.tick>=(u.nativeReadyAt||0)&&this.tick>=(v.brandBurstAt||0)){
  if(this.tick<(v.brandUntil||0)){v.brandUntil=0;v.brandBurstAt=this.tick+72;u.nativeReadyAt=this.tick+72;v.brandBurstUntil=this.tick+12;
   const splash=this.units.filter(w=>w.id!==v.id&&this.active(w)&&w.side!==u.side&&w.lane===v.lane&&Math.abs(w.x-v.x)<=100).sort((a,b)=>Math.abs(a.x-v.x)-Math.abs(b.x-v.x)||a.id-b.id)[0];
   this.hurt(v,24,u,true);if(splash){splash.brandBurstUntil=this.tick+12;this.hurt(splash,12,u,true);}
  }else v.brandUntil=this.tick+96;
 }

};
B.hookable=function(v){return C.units[v.type].genericAnimations!==false&&!C.units[v.type].big&&!C.units[v.type].elephant&&![4,6].includes(v.type)&&!v.knockFrame;};
B.releaseHook=function(u){u.hookPending=false;const v=this.victim(u.targetId),distance=v&&(v.x-u.x)*u.dir;if(!this.active(v)||v.side===u.side||v.lane!==u.lane||!this.hookable(v)||distance<=60||distance>280)return;
 let gap=60;for(const w of this.units)if(w.id!==u.id&&w.id!==v.id&&this.active(w)&&w.lane===u.lane){const wx=(w.x-u.x)*u.dir;if(wx>0&&wx<distance)gap=Math.max(gap,wx+40);}
 const pull=Math.max(0,Math.min(70,distance-gap));this.pushNative(v,-u.dir*pull);u.hookUntil=this.tick+12;u.hookTargetX=v.x;
};
B.braced=function(u){return this.active(u)&&!u.knockFrame&&C.units[u.type].stoneGuard&&(u.braceTicks||0)>=36;};
B.pushNative=function(v,dx){v.x+=dx*(this.braced(v)?.4:1);};
const move=B.move;B.move=function(u,e){const d=C.units[u.type];if(d.supportCast){const v=this.supportTarget(u,600);if(v){const dx=v.x-u.x,step=Math.min(Math.max(0,Math.abs(dx)-100),this.boost(d.speed*2,u.owner,u.type,'speed')*this.slowFactor(u));u.x+=Math.sign(dx)*step;u.moving=step>0;return;}}
 if(d.stoneGuard&&this.target(u,140)){u.moving=false;return;}move.call(this,u,e);};
const knock=B.knock;B.knock=function(v,source){if(source&&[4,6].includes(source.type)&&this.braced(v)&&this.tick>=(v.braceReadyAt||0)){v.braceReadyAt=this.tick+192;v.braceFlashUntil=this.tick+24;v.braceTicks=0;return;}v.braceTicks=0;if(C.units[v.type].hooker)v.hookPending=false;knock.call(this,v);};
const step=B.stepUnit;B.stepUnit=function(u){const oldX=u.x;step.call(this,u);if(C.units[u.type].stoneGuard)u.braceTicks=this.active(u)&&!u.knockFrame&&u.x===oldX&&this.target(u,160)?Math.min(36,(u.braceTicks||0)+1):0;};
const validate=Battle.validateRestoration;Battle.validateRestoration=function(s,C){validate(s,C);const caps={nativeReadyAt:192,wardUntil:120,wardPulseUntil:24,breachUntil:72,brandUntil:96,brandBonusAt:24,brandBurstAt:72,brandBurstUntil:12,hookUntil:12,soulPulseUntil:24,soulCastUntil:18,braceReadyAt:192,braceFlashUntil:24};for(const u of s.units){for(const [key,cap]of Object.entries(caps))if(u[key]!==undefined&&(!Number.isInteger(u[key])||u[key]<0||u[key]>s.tick+cap))throw Error('追加兵种冷却不正确');for(const [key,max]of [['wardHp',35],['souls',3],['breakHits',2],['braceTicks',36]])if(u[key]!==undefined&&(!Number.isFinite(u[key])||u[key]<0||u[key]>max||key!=='wardHp'&&!Number.isInteger(u[key])))throw Error('追加兵种状态不正确');for(const key of ['hookTargetX','soulTargetX'])if(u[key]!==undefined&&(!Number.isFinite(u[key])||Math.abs(u[key])>10000))throw Error('追加兵种目标不正确');if(u.hookPending!==undefined&&typeof u.hookPending!=='boolean')throw Error('钩刃状态不正确');}};
}if(typeof module!=='undefined')module.exports=install;else g.installNativeReinforcements=install;})(globalThis);
